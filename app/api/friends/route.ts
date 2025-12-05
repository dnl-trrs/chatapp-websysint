import { NextRequest, NextResponse } from 'next/server';
import { getAWSCredentials, getAWSRegion } from '@/lib/aws/server-config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client with server-side credentials
const client = new DynamoDBClient({
  region: getAWSRegion(),
  credentials: {
    accessKeyId: getAWSCredentials().accessKeyId,
    secretAccessKey: getAWSCredentials().secretAccessKey
  }
});

const docClient = DynamoDBDocumentClient.from(client);
const FRIENDS_TABLE = 'chatapp-friends';
const USERS_TABLE = 'chatapp-users';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    // Get all friends for the user
    const command = new QueryCommand({
      TableName: FRIENDS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await docClient.send(command);
    const friendRelations = result.Items || [];

    // Get full user details for each friend
    const friends = [];
    for (const relation of friendRelations) {
      const userCommand = new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId: relation.friendId }
      });
      const userResult = await docClient.send(userCommand);
      if (userResult.Item) {
        friends.push({
          ...userResult.Item,
          uid: relation.friendId,
          friendId: relation.friendId,
          addedAt: relation.createdAt
        });
      }
    }

    return NextResponse.json(friends);
  } catch (error) {
    console.error('Error getting friends:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, friendId } = body;

    if (!userId || !friendId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Delete both directions of the friendship
    const delete1Command = new DeleteCommand({
      TableName: FRIENDS_TABLE,
      Key: { userId, friendId }
    });

    const delete2Command = new DeleteCommand({
      TableName: FRIENDS_TABLE,
      Key: { userId: friendId, friendId: userId }
    });

    await Promise.all([
      docClient.send(delete1Command),
      docClient.send(delete2Command)
    ]);

    return NextResponse.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}