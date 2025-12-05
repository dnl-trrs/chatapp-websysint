# Development Guide

This guide covers local development setup and AWS configuration for the ChatApp project.

## Local Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- An AWS account with appropriate permissions

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chatapp-websysint
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env.local`
   - Fill in your AWS credentials and configuration

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint to check code quality

## AWS Configuration

### Required AWS Services

#### 1. Cognito User Pool
- Create a user pool for authentication
- Configure app client with:
  - Client ID
  - User Pool ID
  - Identity Pool ID

#### 2. DynamoDB Tables
Create the following tables with the specified schemas:

**chatapp-users**
- Partition Key: `userId` (String)
- Attributes: email, displayName, username, photoURL, createdAt, updatedAt, status

**chatapp-conversations**
- Partition Key: `conversationId` (String)
- Attributes: type, participants, name, icon, lastMessage, createdAt, updatedAt, createdBy, hiddenBy

**chatapp-messages**
- Partition Key: `conversationId` (String)
- Sort Key: `messageId` (String)
- Attributes: senderId, content, timestamp, readBy, editedAt

**chatapp-friends**
- Partition Key: `userId` (String)
- Sort Key: `friendId` (String)
- Attributes: createdAt, displayName, photoURL

**chatapp-friend-requests**
- Partition Key: `requestId` (String)
- Attributes: fromUserId, toUserId, status, createdAt, updatedAt

#### 3. S3 Bucket
- Create an S3 bucket for file uploads
- Enable CORS with proper settings
- Configure bucket policy for public read access on uploaded files

#### 4. IAM User/Credentials
Create IAM credentials with permissions for:
- DynamoDB: Read/Write on all ChatApp tables
- S3: Put/Get/Delete objects on the chatapp bucket
- Cognito: Read access to user pools

### Environment Variables

Required environment variables for development (`.env.local`):

```env
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-2
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<your-pool-id>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<your-client-id>
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=<your-identity-pool-id>

# DynamoDB Tables
NEXT_PUBLIC_DYNAMODB_USERS_TABLE=chatapp-users
NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE=chatapp-conversations
NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE=chatapp-messages
NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE=chatapp-friends
NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE=chatapp-friend-requests

# S3
NEXT_PUBLIC_S3_BUCKET=your-bucket-name

# Server-side Credentials (keep private - never commit!)
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_ACCOUNT_ID=<your-account-id>
```

## Project Architecture

### Frontend (Next.js)
- Built with React 19 and TypeScript
- Tailwind CSS for styling
- Lucide React for icons
- Custom hooks for state management

### Backend (Next.js API Routes)
- Located in `app/api/*`
- Uses AWS SDK for DynamoDB and S3
- Handles authentication, conversations, messages, friends, and file uploads

### Services Layer (`lib/`)
- `conversationService.ts` - Conversation operations (maps to AWS service)
- `friendService.ts` - Friend management (maps to AWS service)
- `profileService.ts` - Profile updates and picture uploads
- `userService.ts` - User account operations (maps to AWS service)
- `imageUploadService.ts` - Image file uploads to S3
- `typingService.ts` - Typing status indicators
- `aws/` - AWS-specific implementations using DynamoDB, S3, etc.

## Testing

While the project doesn't have automated tests configured, you can manually test features:

1. **Registration/Login**: Create accounts and verify Cognito authentication
2. **Friend Management**: Send and accept friend requests
3. **Direct Messaging**: Create DM conversations with friends
4. **Group Messaging**: Create group chats with multiple participants
5. **Profile Pictures**: Upload and verify profile pictures display correctly

## Debugging

### Enable Debug Logging
Add console.log statements in service files or API routes to see DynamoDB queries and responses.

### Check AWS CloudWatch
- Review CloudWatch logs for Lambda functions and API Gateway (if used)
- Check DynamoDB metrics for table performance

### Verify Database State
Use AWS Console to inspect:
- DynamoDB items in each table
- S3 bucket contents
- Cognito user pool

## Code Style

The project uses:
- ESLint for code quality
- TypeScript for type safety
- Tailwind CSS for styling consistency

Run linting:
```bash
npm run lint
```

## Common Issues

### "Access Denied" errors
- Check IAM credentials and permissions
- Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct

### DynamoDB item not found
- Verify table names match environment variables
- Check item's partition/sort keys in the table

### Profile pictures not uploading
- Ensure S3 bucket has CORS enabled
- Check bucket policy allows public read access
- Verify NEXT_PUBLIC_S3_BUCKET matches actual bucket name

### Authentication failures
- Verify Cognito user pool credentials
- Check NEXT_PUBLIC_COGNITO_* environment variables
- Ensure user is confirmed in Cognito user pool

## Deployment

For production deployment, see your hosting provider's documentation (AWS Amplify, Vercel, etc.). Ensure all environment variables are properly set in production environment.
