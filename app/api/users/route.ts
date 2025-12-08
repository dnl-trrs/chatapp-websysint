import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
// Relies on IAM Role in production (Amplify) or custom env vars if role is restricted
const clientConfig: any = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  maxAttempts: 3
};

// Check for custom credentials (workaround for Amplify UI restriction on AWS_ prefix)
const accessKeyId = process.env.AMPLIFY_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AMPLIFY_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

if (accessKeyId && secretAccessKey) {
  clientConfig.credentials = {
    accessKeyId,
    secretAccessKey
  };
}

const client = new DynamoDBClient(clientConfig);

const docClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE =
  process.env.NEXT_PUBLIC_DYNAMODB_USERS_TABLE ||
  process.env.DYNAMODB_USERS_TABLE ||
  process.env.USERS_TABLE_NAME ||
  'chatapp-users';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const search = searchParams.get('search');

  console.log('Users API GET:', { userId, search });

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
      const trimmedSearch = search.trim();
      if (!trimmedSearch) {
        return NextResponse.json([], { status: 200 });
      }
      const searchLower = trimmedSearch.toLowerCase();
      // Search users
      const command = new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: 'contains(#displayNameLower, :searchLower) OR contains(#usernameLower, :searchLower) OR contains(#emailLower, :searchLower) OR contains(#displayName, :searchOriginal) OR contains(#username, :searchOriginal) OR contains(#email, :searchOriginal)',
        ExpressionAttributeNames: {
          '#displayName': 'displayName',
          '#displayNameLower': 'displayNameLower',
          '#email': 'email',
          '#emailLower': 'emailLower',
          '#username': 'username',
          '#usernameLower': 'usernameLower'
        },
        ExpressionAttributeValues: {
          ':searchOriginal': trimmedSearch,
          ':searchLower': searchLower
        }
      });
      const result = await docClient.send(command);
      return NextResponse.json(result.Items || []);
    } else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    const err = error as any;
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: err?.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...userData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const now = Date.now();
    const normalizedEmail = typeof userData.email === 'string' ? userData.email.trim() : undefined;
    const displayFromPayload =
      typeof userData.displayName === 'string' && userData.displayName.trim()
        ? userData.displayName.trim()
        : undefined;
    const fallbackDisplay =
      typeof userData.username === 'string' && userData.username.trim()
        ? userData.username.trim()
        : normalizedEmail?.split('@')[0] || 'User';
    const resolvedDisplayName = displayFromPayload || fallbackDisplay;
    const resolvedUsername =
      typeof userData.username === 'string' && userData.username.trim()
        ? userData.username.trim()
        : resolvedDisplayName.replace(/\s+/g, '').toLowerCase();
    const item: Record<string, any> = {
      userId,
      ...userData,
      email: normalizedEmail ?? userData.email,
      emailLower: normalizedEmail ? normalizedEmail.toLowerCase() : userData.emailLower,
      displayName: resolvedDisplayName,
      displayNameLower: resolvedDisplayName.toLowerCase(),
      username: resolvedUsername,
      usernameLower: resolvedUsername.toLowerCase(),
      createdAt: now,
      updatedAt: now
    };

    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: item
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

    const processedUpdates: Record<string, any> = { ...updates };

    if (typeof processedUpdates.displayName === 'string') {
      processedUpdates.displayName = processedUpdates.displayName.trim();
      processedUpdates.displayNameLower = processedUpdates.displayName.toLowerCase();
    }
    if (typeof processedUpdates.username === 'string') {
      processedUpdates.username = processedUpdates.username.trim();
      processedUpdates.usernameLower = processedUpdates.username.toLowerCase();
    }
    if (typeof processedUpdates.email === 'string') {
      processedUpdates.email = processedUpdates.email.trim();
      processedUpdates.emailLower = processedUpdates.email.toLowerCase();
    }

    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    Object.keys(processedUpdates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = processedUpdates[key];
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
