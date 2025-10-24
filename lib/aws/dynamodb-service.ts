import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand, 
  UpdateCommand, 
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const docClient = DynamoDBDocumentClient.from(client);

// Table names from environment
const TABLES = {
  users: process.env.NEXT_PUBLIC_DYNAMODB_USERS_TABLE || 'chatapp-users',
  conversations: process.env.NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE || 'chatapp-conversations',
  messages: process.env.NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE || 'chatapp-messages',
  friends: process.env.NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE || 'chatapp-friends',
  friendRequests: process.env.NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE || 'chatapp-friend-requests'
};

// User operations
export const userService = {
  async createUser(userId: string, userData: any) {
    const command = new PutCommand({
      TableName: TABLES.users,
      Item: {
        userId,
        ...userData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });
    await docClient.send(command);
    return { userId, ...userData };
  },

  async getUser(userId: string) {
    const command = new GetCommand({
      TableName: TABLES.users,
      Key: { userId }
    });
    const result = await docClient.send(command);
    return result.Item;
  },

  async updateUser(userId: string, updates: any) {
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
      TableName: TABLES.users,
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
    return result.Attributes;
  },

  async searchUsers(searchTerm: string) {
    const command = new ScanCommand({
      TableName: TABLES.users,
      FilterExpression: 'contains(#name, :search) OR contains(#email, :search) OR contains(#username, :search)',
      ExpressionAttributeNames: {
        '#name': 'displayName',
        '#email': 'email',
        '#username': 'username'
      },
      ExpressionAttributeValues: {
        ':search': searchTerm.toLowerCase()
      }
    });
    const result = await docClient.send(command);
    return result.Items || [];
  }
};

// Conversation operations
export const conversationService = {
  async createConversation(conversationData: any) {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const command = new PutCommand({
      TableName: TABLES.conversations,
      Item: {
        conversationId,
        ...conversationData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageTime: Date.now()
      }
    });
    await docClient.send(command);
    return { conversationId, ...conversationData };
  },

  async getConversation(conversationId: string) {
    const command = new GetCommand({
      TableName: TABLES.conversations,
      Key: { conversationId }
    });
    const result = await docClient.send(command);
    return result.Item;
  },

  async getUserConversations(userId: string) {
    const command = new QueryCommand({
      TableName: TABLES.conversations,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    const result = await docClient.send(command);
    return result.Items || [];
  },

  async updateConversation(conversationId: string, updates: any) {
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
      TableName: TABLES.conversations,
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
    return result.Attributes;
  }
};

// Message operations
export const messageService = {
  async sendMessage(conversationId: string, messageData: any) {
    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    const command = new PutCommand({
      TableName: TABLES.messages,
      Item: {
        conversationId,
        timestamp,
        messageId,
        ...messageData,
        createdAt: timestamp
      }
    });
    
    await docClient.send(command);
    
    // Update conversation's last message time
    await conversationService.updateConversation(conversationId, {
      lastMessageTime: timestamp,
      lastMessage: messageData.content
    });
    
    return { messageId, conversationId, timestamp, ...messageData };
  },

  async getMessages(conversationId: string, limit: number = 50) {
    const command = new QueryCommand({
      TableName: TABLES.messages,
      KeyConditionExpression: 'conversationId = :conversationId',
      ExpressionAttributeValues: {
        ':conversationId': conversationId
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit
    });
    const result = await docClient.send(command);
    return (result.Items || []).reverse(); // Return in chronological order
  },

  async deleteMessage(conversationId: string, timestamp: number) {
    const command = new DeleteCommand({
      TableName: TABLES.messages,
      Key: { conversationId, timestamp }
    });
    await docClient.send(command);
  }
};

// Friends operations
export const friendService = {
  async addFriend(userId: string, friendId: string) {
    // Add friend relationship (bidirectional)
    const batch = new BatchWriteCommand({
      RequestItems: {
        [TABLES.friends]: [
          {
            PutRequest: {
              Item: {
                userId,
                friendId,
                status: 'active',
                createdAt: Date.now()
              }
            }
          },
          {
            PutRequest: {
              Item: {
                userId: friendId,
                friendId: userId,
                status: 'active',
                createdAt: Date.now()
              }
            }
          }
        ]
      }
    });
    await docClient.send(batch);
  },

  async getFriends(userId: string) {
    const command = new QueryCommand({
      TableName: TABLES.friends,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    const result = await docClient.send(command);
    
    // Get full user details for each friend
    const friendIds = (result.Items || []).map(item => item.friendId);
    const friendDetails = await Promise.all(
      friendIds.map(id => userService.getUser(id))
    );
    
    return friendDetails.filter(Boolean);
  },

  async removeFriend(userId: string, friendId: string) {
    // Remove bidirectional relationship
    const batch = new BatchWriteCommand({
      RequestItems: {
        [TABLES.friends]: [
          {
            DeleteRequest: {
              Key: { userId, friendId }
            }
          },
          {
            DeleteRequest: {
              Key: { userId: friendId, friendId: userId }
            }
          }
        ]
      }
    });
    await docClient.send(batch);
  },

  async sendFriendRequest(fromUserId: string, toUserId: string) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const command = new PutCommand({
      TableName: TABLES.friendRequests,
      Item: {
        requestId,
        fromUserId,
        toUserId,
        status: 'pending',
        createdAt: Date.now()
      }
    });
    await docClient.send(command);
    return { requestId, fromUserId, toUserId };
  },

  async getPendingRequests(userId: string) {
    const command = new QueryCommand({
      TableName: TABLES.friendRequests,
      IndexName: 'ToUserIndex',
      KeyConditionExpression: 'toUserId = :userId',
      FilterExpression: '#status = :pending',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':pending': 'pending'
      }
    });
    const result = await docClient.send(command);
    return result.Items || [];
  },

  async acceptFriendRequest(requestId: string) {
    // Get request details
    const getCommand = new GetCommand({
      TableName: TABLES.friendRequests,
      Key: { requestId }
    });
    const request = await docClient.send(getCommand);
    
    if (!request.Item) throw new Error('Request not found');
    
    // Add friend relationship
    await this.addFriend(request.Item.fromUserId, request.Item.toUserId);
    
    // Update request status
    const updateCommand = new UpdateCommand({
      TableName: TABLES.friendRequests,
      Key: { requestId },
      UpdateExpression: 'SET #status = :accepted',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':accepted': 'accepted'
      }
    });
    await docClient.send(updateCommand);
  },

  async rejectFriendRequest(requestId: string) {
    const command = new UpdateCommand({
      TableName: TABLES.friendRequests,
      Key: { requestId },
      UpdateExpression: 'SET #status = :rejected',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':rejected': 'rejected'
      }
    });
    await docClient.send(command);
  }
};

// Typing indicators (using DynamoDB with TTL)
export const typingService = {
  async setTyping(conversationId: string, userId: string, isTyping: boolean) {
    if (isTyping) {
      const command = new PutCommand({
        TableName: TABLES.conversations,
        Item: {
          conversationId: `typing_${conversationId}`,
          userId,
          ttl: Math.floor(Date.now() / 1000) + 10 // Expire after 10 seconds
        }
      });
      await docClient.send(command);
    } else {
      const command = new DeleteCommand({
        TableName: TABLES.conversations,
        Key: { 
          conversationId: `typing_${conversationId}`,
          userId
        }
      });
      await docClient.send(command);
    }
  },

  async getTypingUsers(conversationId: string) {
    const command = new QueryCommand({
      TableName: TABLES.conversations,
      KeyConditionExpression: 'conversationId = :typingId',
      ExpressionAttributeValues: {
        ':typingId': `typing_${conversationId}`
      }
    });
    const result = await docClient.send(command);
    return (result.Items || []).map(item => item.userId);
  }
};

export default {
  userService,
  conversationService,
  messageService,
  friendService,
  typingService
};