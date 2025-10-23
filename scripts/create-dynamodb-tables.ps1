# PowerShell script to create DynamoDB tables for chat app
# Run this in PowerShell after installing and configuring AWS CLI

$aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

Write-Host "Creating DynamoDB tables for chat app..." -ForegroundColor Green

# Create Users Table
Write-Host "Creating chatapp-users table..." -ForegroundColor Yellow
& $aws dynamodb create-table --table-name chatapp-users --attribute-definitions AttributeName=userId,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH --billing-mode PAY_PER_REQUEST --region us-east-2

# Create Conversations Table
Write-Host "Creating chatapp-conversations table..." -ForegroundColor Yellow
& $aws dynamodb create-table --table-name chatapp-conversations --attribute-definitions AttributeName=conversationId,AttributeType=S AttributeName=userId,AttributeType=S --key-schema AttributeName=conversationId,KeyType=HASH --global-secondary-indexes "IndexName=UserIndex,Keys=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL}" --billing-mode PAY_PER_REQUEST --region us-east-2

# Create Messages Table
Write-Host "Creating chatapp-messages table..." -ForegroundColor Yellow
& $aws dynamodb create-table --table-name chatapp-messages --attribute-definitions AttributeName=conversationId,AttributeType=S AttributeName=timestamp,AttributeType=N --key-schema AttributeName=conversationId,KeyType=HASH AttributeName=timestamp,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region us-east-2

# Create Friends Table
Write-Host "Creating chatapp-friends table..." -ForegroundColor Yellow
& $aws dynamodb create-table --table-name chatapp-friends --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=friendId,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH AttributeName=friendId,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region us-east-2

# Create Friend Requests Table
Write-Host "Creating chatapp-friend-requests table..." -ForegroundColor Yellow
& $aws dynamodb create-table --table-name chatapp-friend-requests --attribute-definitions AttributeName=requestId,AttributeType=S AttributeName=fromUserId,AttributeType=S AttributeName=toUserId,AttributeType=S --key-schema AttributeName=requestId,KeyType=HASH --global-secondary-indexes "IndexName=FromUserIndex,Keys=[{AttributeName=fromUserId,KeyType=HASH}],Projection={ProjectionType=ALL}" "IndexName=ToUserIndex,Keys=[{AttributeName=toUserId,KeyType=HASH}],Projection={ProjectionType=ALL}" --billing-mode PAY_PER_REQUEST --region us-east-2

Write-Host "All tables created successfully!" -ForegroundColor Green
Write-Host "You can view them at: https://console.aws.amazon.com/dynamodb" -ForegroundColor Cyan