import { NextRequest, NextResponse } from 'next/server';
import { getAWSCredentials, getAWSRegion } from '@/lib/aws/server-config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client with server-side credentials
const client = new DynamoDBClient({
  region: getAWSRegion(),
  credentials: {
    accessKeyId: getAWSCredentials().accessKeyId,
    secretAccessKey: getAWSCredentials().secretAccessKey
  }
});

const docClient = DynamoDBDocumentClient.from(client);
const FRIEND_REQUESTS_TABLE = 'chatapp-friend-requests';
const FRIENDS_TABLE = 'chatapp-friends';
const USERS_TABLE = 'chatapp-users';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    // Get all requests where user is either sender or receiver
    const scanCommand = new ScanCommand({
      TableName: FRIEND_REQUESTS_TABLE,
      FilterExpression: '(fromUserId = :userId OR toUserId = :userId) AND #status = :pending',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':pending': 'pending'
      }
    });

    const result = await docClient.send(scanCommand);
    const requests = result.Items || [];

    // Enrich with user display names
    for (const request of requests) {
      // Get fromUser details
      if (request.fromUserId) {
        const fromUserCommand = new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: request.fromUserId }
        });
        const fromUserResult = await docClient.send(fromUserCommand);
        if (fromUserResult.Item) {
          request.fromDisplayName = fromUserResult.Item.displayName || 'Unknown User';
        }
      }

      // Get toUser details
      if (request.toUserId) {
        const toUserCommand = new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: request.toUserId }
        });
        const toUserResult = await docClient.send(toUserCommand);
        if (toUserResult.Item) {
          request.toDisplayName = toUserResult.Item.displayName || 'Unknown User';
        }
      }
    }

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error getting friend requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromUserId, toUserId } = body;

    if (!fromUserId || !toUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if request already exists
    const existingRequestScan = new ScanCommand({
      TableName: FRIEND_REQUESTS_TABLE,
      FilterExpression: '((fromUserId = :fromUserId AND toUserId = :toUserId) OR (fromUserId = :toUserId AND toUserId = :fromUserId)) AND #status = :pending',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':fromUserId': fromUserId,
        ':toUserId': toUserId,
        ':pending': 'pending'
      }
    });

    const existingResult = await docClient.send(existingRequestScan);
    if (existingResult.Items && existingResult.Items.length > 0) {
      return NextResponse.json({ error: 'Friend request already exists' }, { status: 409 });
    }

    // Check if already friends
    const friendCheckCommand1 = new GetCommand({
      TableName: FRIENDS_TABLE,
      Key: { userId: fromUserId, friendId: toUserId }
    });
    const friendResult1 = await docClient.send(friendCheckCommand1);
    if (friendResult1.Item) {
      return NextResponse.json({ error: 'Already friends' }, { status: 409 });
    }

    // Create friend request
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const command = new PutCommand({
      TableName: FRIEND_REQUESTS_TABLE,
      Item: {
        requestId,
        fromUserId,
        toUserId,
        status: 'pending',
        createdAt: Date.now()
      }
    });

    await docClient.send(command);
    return NextResponse.json({ requestId, fromUserId, toUserId, status: 'pending' });
  } catch (error) {
    console.error('Error creating friend request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the request
    const getCommand = new GetCommand({
      TableName: FRIEND_REQUESTS_TABLE,
      Key: { requestId }
    });
    const requestResult = await docClient.send(getCommand);
    
    if (!requestResult.Item) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const friendRequest = requestResult.Item;

    if (action === 'accept') {
      // Update request status
      const updateCommand = new UpdateCommand({
        TableName: FRIEND_REQUESTS_TABLE,
        Key: { requestId },
        UpdateExpression: 'SET #status = :accepted, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':accepted': 'accepted',
          ':now': Date.now()
        }
      });
      await docClient.send(updateCommand);

      // Add bidirectional friend relationships
      const friend1Command = new PutCommand({
        TableName: FRIENDS_TABLE,
        Item: {
          userId: friendRequest.fromUserId,
          friendId: friendRequest.toUserId,
          createdAt: Date.now()
        }
      });

      const friend2Command = new PutCommand({
        TableName: FRIENDS_TABLE,
        Item: {
          userId: friendRequest.toUserId,
          friendId: friendRequest.fromUserId,
          createdAt: Date.now()
        }
      });

      await Promise.all([
        docClient.send(friend1Command),
        docClient.send(friend2Command)
      ]);

      return NextResponse.json({ message: 'Friend request accepted' });
    } else if (action === 'reject') {
      // Delete the request
      const deleteCommand = new DeleteCommand({
        TableName: FRIEND_REQUESTS_TABLE,
        Key: { requestId }
      });
      await docClient.send(deleteCommand);

      return NextResponse.json({ message: 'Friend request rejected' });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating friend request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}