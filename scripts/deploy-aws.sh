#!/bin/bash

# AWS Deployment Script for Chat App
# Usage: ./scripts/deploy-aws.sh [amplify|ecs] [staging|production]

set -e

DEPLOYMENT_TYPE=${1:-amplify}
ENVIRONMENT=${2:-staging}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="chatapp"
IMAGE_TAG="latest"

echo "🚀 Starting deployment..."
echo "Type: $DEPLOYMENT_TYPE"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
fi

if [ "$DEPLOYMENT_TYPE" = "ecs" ]; then
    echo "📦 Building Docker image..."
    docker build -t $ECR_REPOSITORY:$IMAGE_TAG .
    
    echo "🔐 Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    
    # Create repository if it doesn't exist
    aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION > /dev/null 2>&1 || \
        aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
    
    echo "⬆️ Pushing image to ECR..."
    docker tag $ECR_REPOSITORY:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
    docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
    
    echo "🔧 Updating ECS task definition..."
    # Replace placeholders in task definition
    sed -e "s|{{ECR_IMAGE_URI}}|$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG|g" \
        -e "s|{{AWS_REGION}}|$AWS_REGION|g" \
        -e "s|{{AWS_ACCOUNT_ID}}|$AWS_ACCOUNT_ID|g" \
        aws/ecs-task-definition.json > /tmp/task-definition.json
    
    # Register new task definition
    TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
        --cli-input-json file:///tmp/task-definition.json \
        --region $AWS_REGION \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    echo "🚢 Updating ECS service..."
    aws ecs update-service \
        --cluster chatapp-cluster \
        --service chatapp-service \
        --task-definition $TASK_DEFINITION_ARN \
        --region $AWS_REGION
    
    echo "✅ ECS deployment complete!"
    
elif [ "$DEPLOYMENT_TYPE" = "amplify" ]; then
    echo "📱 Deploying to AWS Amplify..."
    
    # Check if Amplify app exists
    APP_ID=$(aws amplify list-apps --query "apps[?name=='chatapp-$ENVIRONMENT'].appId" --output text)
    
    if [ -z "$APP_ID" ]; then
        echo "Creating new Amplify app..."
        APP_ID=$(aws amplify create-app \
            --name "chatapp-$ENVIRONMENT" \
            --repository "https://github.com/YOUR_USERNAME/chatapp-websysint" \
            --oauth-token "$GITHUB_TOKEN" \
            --environment-variables \
                NEXT_PUBLIC_AWS_REGION="$NEXT_PUBLIC_AWS_REGION" \
                NEXT_PUBLIC_COGNITO_USER_POOL_ID="$NEXT_PUBLIC_COGNITO_USER_POOL_ID" \
                NEXT_PUBLIC_COGNITO_CLIENT_ID="$NEXT_PUBLIC_COGNITO_CLIENT_ID" \
                NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID="$NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID" \
                NEXT_PUBLIC_S3_BUCKET="$NEXT_PUBLIC_S3_BUCKET" \
                NEXT_PUBLIC_API_GATEWAY_URL="$NEXT_PUBLIC_API_GATEWAY_URL" \
                NEXT_PUBLIC_WEBSOCKET_URL="$NEXT_PUBLIC_WEBSOCKET_URL" \
                NEXT_PUBLIC_DYNAMODB_USERS_TABLE="$NEXT_PUBLIC_DYNAMODB_USERS_TABLE" \
                NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE="$NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE" \
                NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE="$NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE" \
                NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE="$NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE" \
                NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE="$NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE" \
            --build-spec file://amplify.yml \
            --query 'app.appId' \
            --output text)
        
        # Create branch
        aws amplify create-branch \
            --app-id $APP_ID \
            --branch-name main \
            --enable-auto-build
    fi
    
    # Trigger deployment
    JOB_ID=$(aws amplify start-deployment \
        --app-id $APP_ID \
        --branch-name main \
        --query 'jobSummary.jobId' \
        --output text)
    
    echo "📊 Deployment started with Job ID: $JOB_ID"
    echo "Check status at: https://console.aws.amazon.com/amplify/home?region=$AWS_REGION#/$APP_ID/main"
    
    echo "✅ Amplify deployment triggered!"
    
else
    echo "❌ Invalid deployment type. Use 'amplify' or 'ecs'"
    exit 1
fi

echo "🎉 Deployment process complete!"