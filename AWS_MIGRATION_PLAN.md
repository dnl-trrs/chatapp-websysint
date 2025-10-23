# AWS Migration Plan for Chat Application

## Overview
This document outlines a step-by-step migration plan from Firebase to AWS services while maintaining all core functionality (DM, group chats, friends, profiles).

## Migration Strategy
We'll use a **parallel implementation approach** - building AWS services alongside Firebase, then switching over once fully tested.

---

## Phase 1: AWS Infrastructure Setup
**Duration: 1-2 days**  
**Goal: Set up AWS account and core services**

### Tasks:
1. **AWS Account Setup**
   - [ ] Create AWS account (if not exists)
   - [ ] Set up IAM user with appropriate permissions
   - [ ] Install AWS CLI and configure credentials
   - [ ] Set up billing alerts

2. **Core Services Activation**
   - [ ] Enable AWS Cognito (authentication)
   - [ ] Enable DynamoDB (database)
   - [ ] Enable S3 (file storage)
   - [ ] Enable API Gateway (REST/WebSocket APIs)
   - [ ] Enable Lambda (serverless functions)
   - [ ] Enable CloudFront (CDN)

3. **Development Environment**
   - [ ] Install AWS SDK for JavaScript
   - [ ] Set up environment variables for AWS credentials
   - [ ] Create development and production environments

---

## Phase 2: Authentication Migration (Cognito)
**Duration: 2-3 days**  
**Goal: Replace Firebase Auth with AWS Cognito**

### Implementation Steps:

1. **Cognito User Pool Setup**
   ```
   - User attributes: email, name, username, profile picture
   - Password policy matching current requirements
   - Email verification enabled
   - Custom attributes for bio, status, etc.
   ```

2. **Create Auth Service Wrapper**
   ```typescript
   // lib/aws/cognito-auth.ts
   export class CognitoAuthService {
     signIn(email: string, password: string)
     signUp(email: string, password: string, username: string)
     signOut()
     getCurrentUser()
     updateProfile(updates: ProfileData)
     resetPassword(email: string)
   }
   ```

3. **Migration Tasks**
   - [ ] Create Cognito user pool
   - [ ] Implement auth service wrapper
   - [ ] Update useAuth hook to use Cognito
   - [ ] Migrate login/register pages
   - [ ] Test auth flow end-to-end
   - [ ] Implement user migration strategy

---

## Phase 3: Database Migration (DynamoDB)
**Duration: 3-4 days**  
**Goal: Replace Firestore with DynamoDB**

### Database Design:

#### Tables Structure:
```yaml
1. Users Table:
   - PK: userId
   - Attributes: username, email, displayName, bio, photoURL, createdAt
   - GSI: username-index (for user search)

2. Conversations Table:
   - PK: conversationId
   - SK: metadata | message#timestamp
   - GSI: participant-index (for user's conversations)
   - Attributes: type, name, participants[], lastMessage

3. Friends Table:
   - PK: userId
   - SK: friendId
   - Attributes: status, addedAt, friendData

4. FriendRequests Table:
   - PK: toUserId
   - SK: fromUserId  
   - Attributes: status, createdAt, displayNames
```

### Implementation Steps:

1. **Create DynamoDB Service**
   ```typescript
   // lib/aws/dynamodb-service.ts
   export class DynamoDBService {
     // User operations
     createUser(userData)
     getUser(userId)
     updateUser(userId, updates)
     searchUsers(query)
     
     // Conversation operations
     createConversation(conversationData)
     getConversation(conversationId)
     getUserConversations(userId)
     sendMessage(conversationId, message)
     
     // Friend operations
     sendFriendRequest(fromId, toId)
     acceptFriendRequest(requestId)
     getFriends(userId)
   }
   ```

2. **Migration Tasks**
   - [ ] Design and create DynamoDB tables
   - [ ] Implement DynamoDB service wrapper
   - [ ] Create data migration scripts
   - [ ] Update all service files to use DynamoDB
   - [ ] Test CRUD operations

---

## Phase 4: Real-time Messaging (WebSockets)
**Duration: 3-4 days**  
**Goal: Implement real-time features using AWS**

### Architecture:
```
Client <-> API Gateway WebSocket <-> Lambda <-> DynamoDB
                                 \-> SQS (for offline messages)
```

### Implementation Steps:

1. **API Gateway WebSocket Setup**
   - [ ] Create WebSocket API
   - [ ] Define routes: $connect, $disconnect, sendMessage, typing
   - [ ] Implement connection management

2. **Lambda Functions**
   ```typescript
   // lambda/websocket-handler.ts
   - onConnect: Store connection ID
   - onDisconnect: Remove connection ID
   - sendMessage: Broadcast to participants
   - typing: Broadcast typing status
   ```

3. **Client WebSocket Service**
   ```typescript
   // lib/aws/websocket-service.ts
   export class WebSocketService {
     connect(userId)
     disconnect()
     sendMessage(conversationId, message)
     subscribeToMessages(callback)
     setTypingStatus(conversationId, isTyping)
   }
   ```

4. **Migration Tasks**
   - [ ] Set up API Gateway WebSocket
   - [ ] Create Lambda functions
   - [ ] Implement connection management
   - [ ] Update conversation service for real-time
   - [ ] Test real-time messaging

---

## Phase 5: File Storage Migration (S3)
**Duration: 1-2 days**  
**Goal: Replace Firebase Storage with S3**

### Implementation Steps:

1. **S3 Bucket Setup**
   ```
   Bucket: chatapp-uploads
   ├── profile-pictures/
   ├── message-attachments/
   └── group-avatars/
   ```

2. **Create Storage Service**
   ```typescript
   // lib/aws/s3-storage.ts
   export class S3StorageService {
     uploadProfilePicture(userId, file)
     uploadAttachment(conversationId, file)
     getSignedUrl(key)
     deleteFile(key)
   }
   ```

3. **Migration Tasks**
   - [ ] Create S3 bucket with proper permissions
   - [ ] Implement S3 service wrapper
   - [ ] Update profile service for image uploads
   - [ ] Set up CloudFront CDN
   - [ ] Migrate existing files from Firebase Storage

---

## Phase 6: API Gateway & Lambda Functions
**Duration: 2-3 days**  
**Goal: Create REST API endpoints**

### API Endpoints:
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
GET    /users/search
GET    /users/{userId}
PATCH  /users/{userId}
GET    /conversations
POST   /conversations
GET    /conversations/{id}/messages
POST   /friends/request
POST   /friends/accept
DELETE /friends/{friendId}
```

### Lambda Functions:
- [ ] Auth handlers (register, login, refresh)
- [ ] User management functions
- [ ] Conversation CRUD operations
- [ ] Friend system operations
- [ ] Message handling

---

## Phase 7: Frontend Integration
**Duration: 2-3 days**  
**Goal: Update frontend to use AWS services**

### Tasks:
1. **Update Service Layer**
   - [ ] Replace Firebase imports with AWS services
   - [ ] Update API calls to use API Gateway
   - [ ] Update WebSocket connections

2. **Environment Configuration**
   ```env
   NEXT_PUBLIC_AWS_REGION=us-east-1
   NEXT_PUBLIC_COGNITO_POOL_ID=xxx
   NEXT_PUBLIC_COGNITO_CLIENT_ID=xxx
   NEXT_PUBLIC_API_GATEWAY_URL=xxx
   NEXT_PUBLIC_WEBSOCKET_URL=xxx
   ```

3. **Testing**
   - [ ] Test authentication flow
   - [ ] Test messaging (DM and group)
   - [ ] Test friend system
   - [ ] Test file uploads
   - [ ] Test real-time features

---

## Phase 8: Data Migration
**Duration: 1-2 days**  
**Goal: Migrate existing data from Firebase to AWS**

### Migration Strategy:
1. **Export Firebase Data**
   - Users collection
   - Conversations and messages
   - Friend relationships

2. **Transform Data**
   - Map Firebase structure to DynamoDB
   - Convert timestamps
   - Update references

3. **Import to AWS**
   - Batch write to DynamoDB
   - Upload files to S3
   - Verify data integrity

### Scripts Needed:
- [ ] Firebase export script
- [ ] Data transformation script
- [ ] DynamoDB import script
- [ ] Verification script

---

## Phase 9: Testing & Optimization
**Duration: 2-3 days**  
**Goal: Ensure everything works properly**

### Testing Checklist:
- [ ] User registration and login
- [ ] Profile updates with image upload
- [ ] Sending/receiving DMs
- [ ] Creating/managing group chats
- [ ] Friend requests and management
- [ ] Real-time message delivery
- [ ] Typing indicators
- [ ] File uploads
- [ ] Search functionality
- [ ] Error handling
- [ ] Offline message queuing

### Performance Optimization:
- [ ] Implement caching strategy
- [ ] Optimize DynamoDB queries
- [ ] Set up CloudWatch monitoring
- [ ] Configure auto-scaling
- [ ] Implement rate limiting

---

## Phase 10: Deployment & Cutover
**Duration: 1 day**  
**Goal: Switch from Firebase to AWS**

### Deployment Steps:
1. **Pre-deployment**
   - [ ] Final data sync
   - [ ] DNS updates if needed
   - [ ] Update environment variables

2. **Deployment**
   - [ ] Deploy Lambda functions
   - [ ] Deploy frontend with AWS configs
   - [ ] Enable CloudFront distribution

3. **Post-deployment**
   - [ ] Monitor CloudWatch logs
   - [ ] Check all features
   - [ ] Monitor performance

4. **Cleanup**
   - [ ] Remove Firebase dependencies
   - [ ] Delete Firebase project (after backup)
   - [ ] Update documentation

---

## Cost Estimation (Monthly)

### AWS Services:
- **Cognito**: ~$0 (first 50K users free)
- **DynamoDB**: ~$5-10 (on-demand pricing)
- **S3**: ~$1-5 (storage + bandwidth)
- **Lambda**: ~$0-5 (first 1M requests free)
- **API Gateway**: ~$3.50 per million requests
- **CloudFront**: ~$0.085 per GB transfer

**Estimated Total**: $15-30/month for moderate usage

---

## Key Files to Create

```
/lib/aws/
├── cognito-auth.ts       # Authentication service
├── dynamodb-service.ts    # Database operations
├── s3-storage.ts         # File storage
├── websocket-service.ts  # Real-time messaging
└── config.ts             # AWS configuration

/lambda/
├── auth-handlers.ts      # Auth Lambda functions
├── message-handlers.ts   # Message Lambda functions
├── user-handlers.ts      # User Lambda functions
└── websocket-handlers.ts # WebSocket Lambda functions

/scripts/
├── migrate-users.ts      # User migration script
├── migrate-data.ts       # Data migration script
└── setup-aws.ts          # AWS setup script
```

---

## Risk Mitigation

1. **Data Loss Prevention**
   - Keep Firebase as backup during migration
   - Export all data before migration
   - Test migration with subset first

2. **Downtime Minimization**
   - Run AWS and Firebase in parallel initially
   - Use feature flags for gradual rollout
   - Have rollback plan ready

3. **Cost Control**
   - Set up billing alerts
   - Use AWS Free Tier where possible
   - Monitor usage with CloudWatch

---

## Success Criteria

- [ ] All users can log in via Cognito
- [ ] Messages deliver in < 100ms
- [ ] Zero data loss during migration
- [ ] Cost within budget ($30/month)
- [ ] All features working as before
- [ ] Improved scalability

---

## Next Steps

1. **Immediate Actions**:
   - Review this plan and adjust as needed
   - Set up AWS account
   - Start with Phase 1 (Infrastructure)

2. **Questions to Answer**:
   - Expected user volume?
   - Budget constraints?
   - Timeline requirements?
   - Need for additional features?

3. **Support Resources**:
   - AWS Documentation
   - AWS Support (if needed)
   - Community forums

---

*Total Estimated Duration: 20-25 days for complete migration*