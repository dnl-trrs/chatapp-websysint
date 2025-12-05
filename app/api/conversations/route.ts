import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getAWSCredentials, getAWSRegion } from '@/lib/aws/server-config';

// Initialize DynamoDB client with server-side credentials
const client = new DynamoDBClient({
  region: getAWSRegion(),
  credentials: getAWSCredentials()
});

const docClient = DynamoDBDocumentClient.from(client);
const CONVERSATIONS_TABLE = 'chatapp-conversations';
const USERS_TABLE = 'chatapp-users';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const conversationId = searchParams.get('conversationId');

  try {
    if (conversationId) {
      // Get specific conversation
      const command = new GetCommand({
        TableName: CONVERSATIONS_TABLE,
        Key: { conversationId }
      });
      const result = await docClient.send(command);
      return NextResponse.json(result.Item || null);
    } else if (userId) {
      // Get all conversations for a user
      const scanCommand = new ScanCommand({
        TableName: CONVERSATIONS_TABLE,
        FilterExpression: 'contains(participants, :userId)',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      
      const result = await docClient.send(scanCommand);
      const conversations = result.Items || [];
      
      // Enrich with participant details
      for (const conv of conversations) {
        if (conv.participants && conv.type === 'dm') {
          const otherUserId = conv.participants.find((p: string) => p !== userId);
          if (otherUserId) {
            const userCommand = new GetCommand({
              TableName: USERS_TABLE,
              Key: { userId: otherUserId }
            });
            const userResult = await docClient.send(userCommand);
            if (userResult.Item) {
              conv.otherUser = userResult.Item;
            }
          }
        }
      }
      
      return NextResponse.json(conversations);
    } else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in conversations API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId1, userId2, userId, participants, type = 'dm', createdBy, name, icon } = body;

    // Handle both formats - direct userId1/userId2 or participants array
    let actualParticipants: string[] = [];
    let actualCreatedBy: string = '';
    
    if (participants && Array.isArray(participants)) {
      // New format from conversation service
      actualParticipants = participants;
      actualCreatedBy = createdBy || userId || participants[0];
    } else if (userId1 && userId2) {
      // Legacy format
      actualParticipants = [userId1, userId2];
      actualCreatedBy = userId1;
    } else {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if DM already exists (only for DM type)
    if (type === 'dm' && actualParticipants.length === 2) {
      const scanCommand = new ScanCommand({
        TableName: CONVERSATIONS_TABLE,
        FilterExpression: 'contains(participants, :user1) AND contains(participants, :user2) AND #type = :type',
        ExpressionAttributeNames: {
          '#type': 'type'
        },
        ExpressionAttributeValues: {
          ':user1': actualParticipants[0],
          ':user2': actualParticipants[1],
          ':type': 'dm'
        }
      });

      const existingResult = await docClient.send(scanCommand);
      if (existingResult.Items && existingResult.Items.length > 0) {
        // Return existing conversation
        return NextResponse.json(existingResult.Items[0]);
      }
    }

    // Create new conversation
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const command = new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: {
        conversationId,
        type: type || 'dm',
        participants: actualParticipants,
        name: name || undefined,
        icon: icon || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: actualCreatedBy,
        userId: actualCreatedBy // For UserIndex
      }
    });

    await docClient.send(command);
    return NextResponse.json({ 
      conversationId, 
      type: type || 'dm',
      participants: actualParticipants,
      name: name || undefined,
      icon: icon || undefined,
      createdAt: Date.now()
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, updates } = body;

    if (!conversationId || !updates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      TableName: CONVERSATIONS_TABLE,
      Key: { conversationId },
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
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}