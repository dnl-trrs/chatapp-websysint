import { NextRequest, NextResponse } from 'next/server';
import { DYNAMODB_CONFIG, getAWSRegion, getServerAWSCredentials } from '@/lib/aws/unified-config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client with server-side credentials
const credentials = getServerAWSCredentials();
const client = new DynamoDBClient({
  region: getAWSRegion(),
  credentials
});

const docClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE = DYNAMODB_CONFIG.tables.users;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const search = searchParams.get('search');

  try {
    if (userId) {
      // Get specific user
      const command = new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId }
      });
      const result = await docClient.send(command);
      return NextResponse.json(result.Item || null);
    } else if (search) {
      // Search users
      const command = new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: 'contains(#name, :search) OR contains(#email, :search) OR contains(#username, :search)',
        ExpressionAttributeNames: {
          '#name': 'displayName',
          '#email': 'email',
          '#username': 'username'
        },
        ExpressionAttributeValues: {
          ':search': search.toLowerCase()
        }
      });
      const result = await docClient.send(command);
      return NextResponse.json(result.Items || []);
    } else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...userData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        userId,
        ...userData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });

    await docClient.send(command);
    return NextResponse.json({ userId, ...userData });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, updates } = body;

    if (!userId || !updates) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    });

    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}, updatedAt = :updatedAt`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ':updatedAt': Date.now()
      },
      ReturnValues: 'ALL_NEW'
    });

    const result = await docClient.send(command);
    return NextResponse.json(result.Attributes);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}