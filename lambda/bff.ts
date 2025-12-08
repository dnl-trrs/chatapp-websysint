import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-2';

const ddb = new DynamoDBClient({ region: REGION });
const doc = DynamoDBDocumentClient.from(ddb);
const s3 = new S3Client({ region: REGION });

const USERS_TABLE = process.env.USERS_TABLE_NAME || 'chatapp-users';
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE_NAME || 'chatapp-conversations';
const MESSAGES_TABLE = process.env.MESSAGES_TABLE_NAME || 'chatapp-messages';
const FRIENDS_TABLE = process.env.FRIENDS_TABLE_NAME || 'chatapp-friends';
const FRIEND_REQUESTS_TABLE = process.env.FRIEND_REQUESTS_TABLE_NAME || 'chatapp-friend-requests';
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET_NAME || 'chatapp-uploads';

function json(statusCode: number, body: any): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const method = event.requestContext.http.method.toUpperCase();
    const rawPath = event.rawPath || '';

    if (method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'authorization,content-type',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS'
        }
      };
    }

    // Health check
    if (rawPath === '/api/health' && method === 'GET') {
      return json(200, { ok: true, ts: Date.now() });
    }

    // Users API
    if (rawPath.startsWith('/api/users')) {
      if (method === 'GET') {
        const userId = event.queryStringParameters?.userId;
        const search = event.queryStringParameters?.search;

        if (userId) {
          const res = await doc.send(new GetCommand({
            TableName: USERS_TABLE,
            Key: { userId }
          }));
          return json(200, res.Item || null);
        }

        if (search) {
          const scan = await doc.send(new ScanCommand({
            TableName: USERS_TABLE,
            FilterExpression: 'contains(#name, :q) OR contains(#email, :q) OR contains(#username, :q)',
            ExpressionAttributeNames: {
              '#name': 'displayName',
              '#email': 'email',
              '#username': 'username'
            },
            ExpressionAttributeValues: {
              ':q': search.toLowerCase()
            }
          }));
          return json(200, scan.Items || []);
        }

        return json(400, { error: 'Missing parameters' });
      }

      if (method === 'POST') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { userId, ...userData } = body || {};
        if (!userId) return json(400, { error: 'Missing userId' });

        await doc.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: {
            userId,
            ...userData,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }));
        return json(200, { userId, ...userData });
      }

      if (method === 'PUT') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { userId, updates } = body || {};
        if (!userId || !updates) return json(400, { error: 'Missing parameters' });

        const updateExpressions: string[] = [];
        const expressionAttributeValues: Record<string, any> = {};
        const expressionAttributeNames: Record<string, string> = {};

        Object.keys(updates).forEach((key, index) => {
          const aName = `#attr${index}`;
          const aVal = `:val${index}`;
          updateExpressions.push(`${aName} = ${aVal}`);
          expressionAttributeNames[aName] = key;
          expressionAttributeValues[aVal] = (updates as any)[key];
        });

        const res = await doc.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}, updatedAt = :updatedAt`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: { ...expressionAttributeValues, ':updatedAt': Date.now() },
          ReturnValues: 'ALL_NEW'
        }));

        return json(200, res.Attributes || { success: true });
      }

      return json(405, { error: 'Method not allowed' });
    }

    // Conversations API
    if (rawPath.startsWith('/api/conversations')) {
      if (method === 'GET') {
        const conversationId = event.queryStringParameters?.conversationId;
        const userId = event.queryStringParameters?.userId;

        if (conversationId) {
          const res = await doc.send(new GetCommand({
            TableName: CONVERSATIONS_TABLE,
            Key: { conversationId }
          }));
          return json(200, res.Item || null);
        }

        if (userId) {
          // Simple scan (MVP)
          const scan = await doc.send(new ScanCommand({
            TableName: CONVERSATIONS_TABLE,
            FilterExpression: 'contains(participants, :userId)',
            ExpressionAttributeValues: { ':userId': userId }
          }));
          const conversations = scan.Items || [];
          return json(200, conversations);
        }

        return json(400, { error: 'Missing parameters' });
      }

      if (method === 'POST') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { userId1, userId2, participants, type = 'dm', createdBy, name, icon, userId } = body || {};

        let actualParticipants: string[] = [];
        let actualCreatedBy: string = '';

        if (Array.isArray(participants) && participants.length > 0) {
          actualParticipants = participants;
          actualCreatedBy = createdBy || userId || participants[0];
        } else if (userId1 && userId2) {
          actualParticipants = [userId1, userId2];
          actualCreatedBy = userId1;
        } else {
          return json(400, { error: 'Missing required fields' });
        }

        const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await doc.send(new PutCommand({
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
          }
        }));

        return json(200, {
          conversationId,
          type: type || 'dm',
          participants: actualParticipants,
          name: name || undefined,
          icon: icon || undefined,
          createdAt: Date.now()
        });
      }

      if (method === 'PUT') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { conversationId, updates } = body || {};
        if (!conversationId || !updates) return json(400, { error: 'Missing required fields' });

        const updateExpressions: string[] = [];
        const expressionAttributeValues: Record<string, any> = {};
        const expressionAttributeNames: Record<string, string> = {};

        Object.keys(updates).forEach((key, index) => {
          const aName = `#attr${index}`;
          const aVal = `:val${index}`;
          updateExpressions.push(`${aName} = ${aVal}`);
          expressionAttributeNames[aName] = key;
          expressionAttributeValues[aVal] = updates[key];
        });

        const res = await doc.send(new UpdateCommand({
          TableName: CONVERSATIONS_TABLE,
          Key: { conversationId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}, updatedAt = :updatedAt`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: { ...expressionAttributeValues, ':updatedAt': Date.now() },
          ReturnValues: 'ALL_NEW'
        }));

        return json(200, res.Attributes || { success: true });
      }

      return json(405, { error: 'Method not allowed' });
    }

    // Messages API
    if (rawPath.startsWith('/api/messages')) {
      if (method === 'GET') {
        const conversationId = event.queryStringParameters?.conversationId;
        const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
        if (!conversationId) return json(400, { error: 'Missing conversationId' });

        const q = await doc.send(new QueryCommand({
          TableName: MESSAGES_TABLE,
          KeyConditionExpression: 'conversationId = :cid',
          ExpressionAttributeValues: { ':cid': conversationId },
          ScanIndexForward: false,
          Limit: limit
        }));

        const messages = (q.Items || []).reverse();

        // Enrich with user profile data
        for (const m of messages) {
          if (m.senderId) {
            const u = await doc.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: m.senderId } }));
            if (u.Item) {
              m.displayName = u.Item.displayName || 'Unknown';
              m.photoURL = u.Item.photoURL || '';
            }
          }
        }

        return json(200, messages);
      }

      if (method === 'POST') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { conversationId, senderId, text, content } = body || {};
        if (!conversationId || !senderId || !(text || content)) {
          return json(400, { error: 'Missing required fields' });
        }

        const timestamp = Date.now();
        const messageId = `msg_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;

        // Get sender details
        const user = await doc.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: senderId } }));
        const senderData: any = user.Item || {};

        // Fetch conversation to clean up hidden state
        let conversationData: any = null;
        try {
          const convoRes = await doc.send(new GetCommand({ TableName: CONVERSATIONS_TABLE, Key: { conversationId } }));
          conversationData = convoRes.Item || null;
        } catch (err) {
          console.warn('Could not fetch conversation before message send:', err);
        }

        // Save message
        await doc.send(new PutCommand({
          TableName: MESSAGES_TABLE,
          Item: {
            conversationId,
            timestamp,
            messageId,
            senderId,
            text: text ?? content,
            content: text ?? content,
            displayName: senderData.displayName || 'Unknown',
            photoURL: senderData.photoURL || '',
            createdAt: timestamp,
            readBy: [senderId]
          }
        }));

        // Update conversation last message
        const participants = conversationData?.participants || [];
        const hiddenBy = conversationData?.hiddenBy || [];
        const cleanedHiddenBy = hiddenBy.filter((id: string) => !participants.includes(id));

        await doc.send(new UpdateCommand({
          TableName: CONVERSATIONS_TABLE,
          Key: { conversationId },
          UpdateExpression: 'SET lastMessage = :last, lastMessageTime = :ts, updatedAt = :ts, hiddenBy = :hiddenBy',
          ExpressionAttributeValues: {
            ':last': {
              text: text ?? content,
              senderId,
              senderDisplayName: senderData.displayName || 'Unknown',
              timestamp
            },
            ':ts': timestamp,
            ':hiddenBy': cleanedHiddenBy
          }
        }));

        return json(200, {
          messageId,
          conversationId,
          timestamp,
          senderId,
          text: text ?? content,
          displayName: senderData.displayName,
          photoURL: senderData.photoURL
        });
      }

      return json(405, { error: 'Method not allowed' });
    }

    // Friend Requests API
    if (rawPath.startsWith('/api/friend-requests')) {
      if (method === 'GET') {
        const userId = event.queryStringParameters?.userId;
        if (!userId) return json(400, { error: 'Missing userId' });

        const scan = await doc.send(new ScanCommand({
          TableName: FRIEND_REQUESTS_TABLE,
          FilterExpression: '(fromUserId = :uid OR toUserId = :uid) AND #status = :pending',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':uid': userId, ':pending': 'pending' },
        }));
        const requests = scan.Items || [];

        for (const r of requests) {
          if (r.fromUserId) {
            const fu = await doc.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: r.fromUserId } }));
            if (fu.Item) r.fromDisplayName = fu.Item.displayName || 'Unknown User';
          }
          if (r.toUserId) {
            const tu = await doc.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: r.toUserId } }));
            if (tu.Item) r.toDisplayName = tu.Item.displayName || 'Unknown User';
          }
        }
        return json(200, requests);
      }

      if (method === 'POST') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { fromUserId, toUserId } = body || {};
        if (!fromUserId || !toUserId) return json(400, { error: 'Missing required fields' });

        // Check existing pending request
        const existing = await doc.send(new ScanCommand({
          TableName: FRIEND_REQUESTS_TABLE,
          FilterExpression: '((fromUserId = :from AND toUserId = :to) OR (fromUserId = :to AND toUserId = :from)) AND #status = :pending',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':from': fromUserId, ':to': toUserId, ':pending': 'pending' }
        }));
        if (existing.Items && existing.Items.length > 0) {
          return json(409, { error: 'Friend request already exists' });
        }

        // Check already friends
        const f1 = await doc.send(new GetCommand({ TableName: FRIENDS_TABLE, Key: { userId: fromUserId, friendId: toUserId } }));
        if (f1.Item) return json(409, { error: 'Already friends' });

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await doc.send(new PutCommand({
          TableName: FRIEND_REQUESTS_TABLE,
          Item: { requestId, fromUserId, toUserId, status: 'pending', createdAt: Date.now() }
        }));
        return json(200, { requestId, fromUserId, toUserId, status: 'pending' });
      }

      if (method === 'PUT') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { requestId, action } = body || {};
        if (!requestId || !action) return json(400, { error: 'Missing required fields' });

        const req = await doc.send(new GetCommand({ TableName: FRIEND_REQUESTS_TABLE, Key: { requestId } }));
        if (!req.Item) return json(404, { error: 'Request not found' });
        const item = req.Item as any;

        if (action === 'accept') {
          await doc.send(new UpdateCommand({
            TableName: FRIEND_REQUESTS_TABLE,
            Key: { requestId },
            UpdateExpression: 'SET #status = :accepted, updatedAt = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':accepted': 'accepted', ':now': Date.now() }
          }));

          await Promise.all([
            doc.send(new PutCommand({ TableName: FRIENDS_TABLE, Item: { userId: item.fromUserId, friendId: item.toUserId, createdAt: Date.now() } })),
            doc.send(new PutCommand({ TableName: FRIENDS_TABLE, Item: { userId: item.toUserId, friendId: item.fromUserId, createdAt: Date.now() } }))
          ]);
          return json(200, { message: 'Friend request accepted' });
        }

        if (action === 'reject') {
          // delete the request
          await doc.send(new UpdateCommand({
            TableName: FRIEND_REQUESTS_TABLE,
            Key: { requestId },
            UpdateExpression: 'SET #status = :rejected, updatedAt = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':rejected': 'rejected', ':now': Date.now() }
          }));
          return json(200, { message: 'Friend request rejected' });
        }

        return json(400, { error: 'Invalid action' });
      }

      return json(405, { error: 'Method not allowed' });
    }

    // Friends API
    if (rawPath.startsWith('/api/friends')) {
      if (method === 'GET') {
        const userId = event.queryStringParameters?.userId;
        if (!userId) return json(400, { error: 'Missing userId' });

        const q = await doc.send(new QueryCommand({
          TableName: FRIENDS_TABLE,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': userId }
        }));
        const relations = q.Items || [];

        const friends: any[] = [];
        for (const rel of relations) {
          const u = await doc.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: rel.friendId } }));
          if (u.Item) friends.push({ ...u.Item, uid: rel.friendId, friendId: rel.friendId, addedAt: rel.createdAt });
        }
        return json(200, friends);
      }

      if (method === 'DELETE') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { userId, friendId } = body || {};
        if (!userId || !friendId) return json(400, { error: 'Missing required fields' });

        await Promise.all([
          doc.send(new DeleteCommand({ TableName: FRIENDS_TABLE, Key: { userId, friendId } })),
          doc.send(new DeleteCommand({ TableName: FRIENDS_TABLE, Key: { userId: friendId, friendId: userId } })),
        ]);
        return json(200, { message: 'Friend removed successfully' });
      }

      return json(405, { error: 'Method not allowed' });
    }

    // Upload API (presigned URL flow and simple JSON upload)
    if (rawPath.startsWith('/api/upload')) {
      if (method === 'GET') {
        const fileName = event.queryStringParameters?.fileName;
        const fileType = event.queryStringParameters?.fileType;
        const userId = event.queryStringParameters?.userId;
        const type = event.queryStringParameters?.type || 'profile';
        if (!fileName || !fileType || !userId) return json(400, { error: 'Missing parameters' });

        const ext = fileName.split('.').pop();
        const key = `${type}/${userId}/${Date.now()}.${ext}`;
        const command = new PutObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key, ContentType: fileType });
        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        const publicUrl = `https://${UPLOADS_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
        return json(200, { signedUrl, publicUrl, key });
      }

      if (method === 'POST') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { userId, data, contentType, type = 'profile', fileName } = body || {};
        if (!userId || !data || !contentType) return json(400, { error: 'Missing required fields' });

        const ext = (fileName && fileName.includes('.')) ? fileName.split('.').pop() : contentType.split('/')[1] || 'bin';
        const key = `${type}/${userId}/${Date.now()}.${ext}`;

        // Support data URL or raw base64
        const base64 = data.includes(',') ? data.split(',')[1] : data;
        const buffer = Buffer.from(base64, 'base64');

        await s3.send(new PutObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
        const publicUrl = `https://${UPLOADS_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
        return json(200, { url: publicUrl, key });
      }

      if (method === 'DELETE') {
        const body = event.body ? JSON.parse(event.body) : {};
        const { key } = body || {};
        if (!key) return json(400, { error: 'Missing key' });
        await s3.send(new DeleteObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key }));
        return json(200, { success: true });
      }

      return json(405, { error: 'Method not allowed' });
    }

    return json(404, { error: 'Not found' });
  } catch (err: any) {
    console.error('Handler error', err);
    return json(500, { error: err?.message || 'Internal error' });
  }
};
