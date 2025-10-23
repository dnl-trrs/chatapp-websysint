# DynamoDB Tables Setup - Quick Guide

## Prerequisites
You need AWS credentials configured. If not done yet:
1. Go to AWS IAM Console
2. Create/select a user
3. Generate Access Keys
4. Configure AWS CLI: `aws configure`

## Create Tables via AWS Console

Go to: https://console.aws.amazon.com/dynamodb

### Table 1: chatapp-users
- **Table name**: `chatapp-users`
- **Partition key**: `userId` (String)
- **Settings**: Default settings
- Click "Create table"

### Table 2: chatapp-conversations  
- **Table name**: `chatapp-conversations`
- **Partition key**: `conversationId` (String)
- **Settings**: Default settings
- Click "Create table"
- After creation → Indexes tab → Create index:
  - **Partition key**: `userId` (String)
  - **Index name**: `UserIndex`

### Table 3: chatapp-messages
- **Table name**: `chatapp-messages`
- **Partition key**: `conversationId` (String)
- **Sort key**: `timestamp` (Number)
- **Settings**: Default settings
- Click "Create table"

### Table 4: chatapp-friends
- **Table name**: `chatapp-friends`
- **Partition key**: `userId` (String)
- **Sort key**: `friendId` (String)
- **Settings**: Default settings
- Click "Create table"

### Table 5: chatapp-friend-requests
- **Table name**: `chatapp-friend-requests`
- **Partition key**: `requestId` (String)
- **Settings**: Default settings
- Click "Create table"
- After creation → Indexes tab → Create 2 indexes:
  - **Index 1**: Partition key: `fromUserId` (String), Name: `FromUserIndex`
  - **Index 2**: Partition key: `toUserId` (String), Name: `ToUserIndex`

## Or Use AWS CLI (After Configuring Credentials)

Once you have AWS credentials configured, run:

```powershell
# Configure AWS (one time)
aws configure

# Then run the setup script
.\scripts\create-dynamodb-tables.ps1
```

## Verify Tables Created

Check your tables at: https://console.aws.amazon.com/dynamodb/home#tables:

You should see:
- chatapp-users
- chatapp-conversations
- chatapp-messages  
- chatapp-friends
- chatapp-friend-requests

## Cost Notes

Using PAY_PER_REQUEST billing mode means:
- No upfront costs
- Pay only for actual reads/writes
- Perfect for development and variable traffic
- Approximately $0.25 per million read requests
- Approximately $1.25 per million write requests