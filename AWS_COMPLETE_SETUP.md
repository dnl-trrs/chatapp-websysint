# Complete AWS Setup Guide for Chat Application

## Quick Setup (5 Steps)

### Step 1: Create AWS Account & IAM User
1. Go to [AWS Console](https://aws.amazon.com/console/)
2. Navigate to **IAM** → **Users** → **Create User**
3. Create a user with programmatic access
4. Attach the policy from `aws-iam-policy.json` or use **AdministratorAccess** for testing

### Step 2: Configure AWS CLI
```powershell
# Install AWS CLI if not already installed
# Download from: https://aws.amazon.com/cli/

# Configure AWS credentials
aws configure
# Enter your Access Key ID
# Enter your Secret Access Key
# Enter region: us-east-2
# Enter output format: json
```

### Step 3: Create DynamoDB Tables
```powershell
# Run the setup script
.\scripts\create-dynamodb-tables.ps1
```

### Step 4: Set Up Environment Variables
```powershell
# Copy the template
Copy-Item .env.aws.complete .env.local

# Edit .env.local and add your AWS credentials:
notepad .env.local
```

Add these values to `.env.local`:
```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
NEXT_PUBLIC_AWS_REGION=us-east-2
```

### Step 5: Start the Application
```powershell
npm install
npm run dev
```

## What This Setup Provides

### ✅ Complete AWS Integration
- **DynamoDB** for all data storage (users, messages, friends, conversations)
- **Automatic service selection** (uses AWS if configured, falls back to Firebase)
- **All permissions configured** for friend requests and messaging

### ✅ Features Enabled
1. **User Management** - Create and manage user profiles
2. **Friend System** - Send/accept/reject friend requests
3. **Direct Messaging** - Send messages between friends
4. **Group Chats** - Create and manage group conversations
5. **Real-time Updates** - Polling-based updates (WebSocket support coming soon)

## Detailed IAM Permissions

The `aws-iam-policy.json` file includes:

### DynamoDB Permissions
- Full CRUD operations on all chatapp tables
- Query and scan capabilities
- Index access for efficient queries

### Future-Ready Permissions
- Cognito for authentication (optional)
- S3 for file uploads (optional)

## Testing Your Setup

### 1. Verify Tables Created
```powershell
aws dynamodb list-tables --query "TableNames[?starts_with(@, 'chatapp-')]"
```

### 2. Test in the App
1. Create a new user account
2. Search for another user
3. Send a friend request
4. Accept the friend request
5. Start a conversation and send messages

## Troubleshooting

### Error: "AWS CLI not found"
- Download and install from: https://aws.amazon.com/cli/

### Error: "Access Denied" 
- Ensure your IAM user has the permissions from `aws-iam-policy.json`
- Check that your credentials in `.env.local` are correct

### Error: "Table already exists"
- Tables are already created, you can proceed

### App still using Firebase
- Ensure AWS credentials are in `.env.local`
- Restart the development server: `npm run dev`
- Check browser console for "Chat app is using aws services"

## Cost Estimates

With PAY_PER_REQUEST billing mode:
- **Development/Testing**: < $1/month
- **Small Production** (1000 users): ~$5-10/month
- **No upfront costs or minimum fees**

## Next Steps

Once everything is working:

1. **Set up Cognito** for AWS-native authentication
2. **Configure S3** for file uploads
3. **Add API Gateway + Lambda** for serverless backend
4. **Implement WebSockets** for real-time messaging

## Support Files

- `aws-iam-policy.json` - IAM permissions needed
- `scripts/create-dynamodb-tables.ps1` - Table creation script
- `.env.aws.complete` - Environment variable template
- `lib/aws/dynamodb-service.ts` - DynamoDB service implementation
- `lib/aws/aws-friend-service.ts` - Friend service using DynamoDB
- `lib/aws/aws-conversation-service.ts` - Conversation service using DynamoDB

## Migration from Firebase

The app now automatically uses AWS when configured. Your Firebase data remains untouched, and you can switch back anytime by removing AWS credentials from `.env.local`.

## Questions?

Check the browser console for detailed logs about which service is being used and any errors that occur.