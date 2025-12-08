import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client using default credential provider chain in prod.
const dynamoConfig: any = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  maxAttempts: 3,
};
const akid = process.env.AMPLIFY_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const sak = process.env.AMPLIFY_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
if (akid && sak) {
  dynamoConfig.credentials = { accessKeyId: akid, secretAccessKey: sak };
}
const client = new DynamoDBClient(dynamoConfig);

const docClient = DynamoDBDocumentClient.from(client);
const MESSAGES_TABLE =
  process.env.NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE ||
  process.env.MESSAGES_TABLE_NAME ||
  'chatapp-messages';
const CONVERSATIONS_TABLE =
  process.env.NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE ||
  process.env.CONVERSATIONS_TABLE_NAME ||
  'chatapp-conversations';
const USERS_TABLE =
  process.env.NEXT_PUBLIC_DYNAMODB_USERS_TABLE ||
  process.env.DYNAMODB_USERS_TABLE ||
  process.env.USERS_TABLE_NAME ||
  'chatapp-users';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversationId');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  try {
    // Get messages for conversation
    const command = new QueryCommand({
      TableName: MESSAGES_TABLE,
      KeyConditionExpression: 'conversationId = :conversationId',
      ExpressionAttributeValues: {
        ':conversationId': conversationId
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit
    });

    const result = await docClient.send(command);
    const messages = (result.Items || []).reverse(); // Return in chronological order
    
    // Enrich with user details
    for (const message of messages) {
      if (message.senderId) {
        const userCommand = new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: message.senderId }
        });
        const userResult = await docClient.send(userCommand);
        if (userResult.Item) {
          message.displayName = userResult.Item.displayName;
          message.photoURL = userResult.Item.photoURL;
        }
      }
    }
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, senderId, text } = body;

    if (!conversationId || !senderId || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get sender details
    const userCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: senderId }
    });
    const userResult = await docClient.send(userCommand);
    const senderData = userResult.Item || {};
    
    // Save message
    const command = new PutCommand({
      TableName: MESSAGES_TABLE,
      Item: {
        conversationId,
        timestamp,
        messageId,
        senderId,
        text,
        content: text,
        displayName: senderData.displayName || 'Unknown',
        photoURL: senderData.photoURL || '',
        createdAt: timestamp,
        readBy: [senderId]
      }
    });
    
    await docClient.send(command);
    
    // Update conversation's last message
    const updateCommand = new UpdateCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: { conversationId },
      UpdateExpression: 'SET lastMessage = :lastMessage, lastMessageTime = :timestamp, updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':lastMessage': {
          text,
          senderId,
          senderDisplayName: senderData.displayName || 'Unknown',
          timestamp
        },
        ':timestamp': timestamp
      }
    });
    
    await docClient.send(updateCommand);
    
    return NextResponse.json({ 
      messageId, 
      conversationId, 
      timestamp, 
      senderId,
      text,
      displayName: senderData.displayName,
      photoURL: senderData.photoURL
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
