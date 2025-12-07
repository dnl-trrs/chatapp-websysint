# ChatApp - Real-time Messaging Application

A modern real-time messaging application built with Next.js and AWS services. This app allows users to communicate through direct messages and group conversations.

## Core Features

- **User Authentication**: Register and login with secure credential storage via AWS Cognito
- **Friend Management**: Send and accept friend requests to build your network
- **Direct Messaging**: Start 1-on-1 conversations with friends
- **Group Messaging**: Create group chats with multiple participants (up to 10 users)
- **Profile Pictures**: Upload and display profile pictures from AWS S3
- **Persistent Conversations**: Close conversations and return later with message history intact

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with AWS SDK
- **Authentication**: AWS Cognito
- **Database**: AWS DynamoDB
- **File Storage**: AWS S3
- **UI Components**: Lucide React icons, custom components

## Prerequisites

- Node.js 18+
- npm or yarn
- AWS Account with:
  - Cognito User Pool configured
  - DynamoDB tables created
  - S3 bucket for file uploads
  - IAM credentials for server-side operations

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd chatapp-websysint
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-2

# AWS Cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=your-identity-pool-id

# AWS DynamoDB Tables
NEXT_PUBLIC_DYNAMODB_USERS_TABLE=chatapp-users
NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE=chatapp-conversations
NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE=chatapp-messages
NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE=chatapp-friends
NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE=chatapp-friend-requests

# AWS S3
NEXT_PUBLIC_S3_BUCKET=your-s3-bucket-name

# Server-side AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_ACCOUNT_ID=your-account-id
```

If you deployed the CDK stack, you can keep the local file and AWS Amplify in sync with the outputs produced during deployment:

1. `cd infra && cdk deploy`
2. Populate AWS Systems Manager Parameter Store with the latest outputs:
   ```bash
   node scripts/sync-ssm-from-outputs.js
   ```
   The script respects `SSM_BASE_PATH` (default `/chatapp/prod/`) and `SSM_REGION`/`AWS_REGION`.
3. Generate a local `.env.local` directly from those parameters when developing locally:
   ```bash
   node scripts/generate-env-from-ssm.js
   ```
4. Configure the same parameters inside the Amplify console (under backend environment variables) by pointing it to the same Parameter Store path.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/              # Next.js API routes
│   │   ├── conversations # Conversation management endpoints
│   │   ├── friend-requests # Friend request endpoints
│   │   ├── friends      # Friend list endpoints
│   │   ├── messages     # Message endpoints
│   │   ├── upload       # File upload to S3
│   │   └── users        # User profile endpoints
│   ├── chat/            # Chat dashboard page
│   ├── login/           # Login page
│   ├── register/        # Registration page
│   └── page.tsx         # Home page
├── components/          # React components
│   ├── AuthWrapper      # Authentication wrapper
│   ├── ChatDashboard    # Main chat interface
│   ├── FriendsPanel     # Friends list
│   ├── FriendsModal     # Add friend modal
│   ├── GroupChatManageModal # Group chat management
│   ├── ProfileModal     # User profile view
│   ├── UserProfileCard  # Profile card display
│   └── Toast            # Notification component
├── hooks/               # Custom React hooks
│   ├── useAuth          # Authentication hook
│   └── useUserProfile   # User profile hook
├── lib/                 # Utilities and services
│   ├── aws/             # AWS-specific implementations
│   ├── conversationService.ts  # Conversation operations
│   ├── friendService.ts        # Friend operations
│   ├── profileService.ts       # Profile operations
│   ├── imageUploadService.ts   # Image uploads
│   ├── userService.ts          # User operations
│   └── typingService.ts        # Typing indicators
└── public/              # Static assets
```

## Database Schema

### Users Table
- `userId` (PK): User's unique identifier
- `email`: User's email address
- `displayName`: User's display name
- `username`: Unique username for finding users
- `photoURL`: S3 URL to profile picture
- `createdAt`: Account creation timestamp
- `updatedAt`: Last profile update timestamp
- `status`: Online/offline status

### Conversations Table
- `conversationId` (PK): Unique conversation identifier
- `type`: "dm" or "group"
- `participants`: List of user IDs in the conversation
- `name`: Group chat name (optional)
- `icon`: S3 URL to group photo (optional)
- `createdAt`: Conversation creation time
- `updatedAt`: Last update time
- `createdBy`: Creator's user ID
- `hiddenBy`: List of users who hid this conversation

### Messages Table
- `messageId` (PK): Unique message identifier
- `conversationId` (SK): Conversation this message belongs to
- `senderId`: User who sent the message
- `content`: Message text
- `timestamp`: When message was sent
- `readBy`: List of users who read the message
- `editedAt`: Last edit timestamp (optional)

### Friends Table
- `userId` (PK): User ID
- `friendId` (SK): Friend's user ID
- `createdAt`: When friendship was established
- `displayName`: Friend's display name
- `photoURL`: Friend's profile picture URL

### Friend Requests Table
- `requestId` (PK): Unique request identifier
- `fromUserId`: User sending the request
- `toUserId`: User receiving the request
- `status`: "pending", "accepted", or "rejected"
- `createdAt`: When request was sent
- `updatedAt`: Last status change

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login

### Conversations
- `GET /api/conversations?userId=<id>` - Get user's conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/<id>` - Get conversation details

### Messages
- `GET /api/messages?conversationId=<id>` - Get conversation messages
- `POST /api/messages` - Send a message
- `GET /api/messages/<id>` - Get message details

### Friends
- `GET /api/friends?userId=<id>` - Get user's friends
- `POST /api/friends` - Add friend
- `DELETE /api/friends` - Remove friend

### Friend Requests
- `GET /api/friend-requests?userId=<id>` - Get pending requests
- `POST /api/friend-requests` - Send friend request
- `PUT /api/friend-requests/<id>` - Accept/reject request
- `DELETE /api/friend-requests/<id>` - Delete request

### File Upload
- `POST /api/upload` - Upload file to S3

## Building for Production

```bash
npm run build
npm start
```

## License

This project is proprietary and confidential.
