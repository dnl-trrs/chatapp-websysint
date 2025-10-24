# AWS Deployment Script for Chat App (PowerShell)
# Usage: .\scripts\deploy-aws.ps1 [-DeploymentType amplify|ecs] [-Environment staging|production]

param(
    [string]$DeploymentType = "amplify",
    [string]$Environment = "staging"
)

$ErrorActionPreference = "Stop"

# Configuration
$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-2" }
$REPO_URL = "https://github.com/dnl-trrs/chatapp-websysint"

Write-Host "Starting deployment..." -ForegroundColor Green
Write-Host "Type: $DeploymentType"
Write-Host "Environment: $Environment"
Write-Host "Region: $AWS_REGION"

# Load environment variables from .env.local
if (Test-Path ".env.local") {
    Write-Host "Loading environment variables from .env.local..." -ForegroundColor Yellow
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

if ($DeploymentType -eq "amplify") {
    Write-Host "Deploying to AWS Amplify via CLI..." -ForegroundColor Cyan
    
    $APP_NAME = "chatapp-$Environment"
    
    # Check if app already exists
    Write-Host "Checking if Amplify app exists..." -ForegroundColor Yellow
    $existingApp = aws amplify list-apps --query "apps[?name=='$APP_NAME'].appId" --output text 2>$null
    
    if (-not $existingApp) {
        Write-Host "Creating new Amplify app..." -ForegroundColor Green
        
        # Create the app with environment variables
        $APP_ID = aws amplify create-app `
            --name $APP_NAME `
            --repository $REPO_URL `
            --platform "WEB" `
            --build-spec (Get-Content "amplify.yml" -Raw) `
            --environment-variables @"
NEXT_PUBLIC_AWS_REGION=$env:NEXT_PUBLIC_AWS_REGION
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$env:NEXT_PUBLIC_COGNITO_USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$env:NEXT_PUBLIC_COGNITO_CLIENT_ID
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=$env:NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID
NEXT_PUBLIC_S3_BUCKET=$env:NEXT_PUBLIC_S3_BUCKET
NEXT_PUBLIC_API_GATEWAY_URL=$env:NEXT_PUBLIC_API_GATEWAY_URL
NEXT_PUBLIC_WEBSOCKET_URL=$env:NEXT_PUBLIC_WEBSOCKET_URL
NEXT_PUBLIC_DYNAMODB_USERS_TABLE=$env:NEXT_PUBLIC_DYNAMODB_USERS_TABLE
NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE=$env:NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE
NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE=$env:NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE
NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE=$env:NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE
NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE=$env:NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE
"@ `
            --query 'app.appId' `
            --output text
            
        Write-Host "Created app with ID: $APP_ID" -ForegroundColor Green
        
        # Create main branch
        Write-Host "Creating main branch..." -ForegroundColor Yellow
        aws amplify create-branch `
            --app-id $APP_ID `
            --branch-name main `
            --enable-auto-build `
            --framework "Next.js - SSR" `
            --stage PRODUCTION `
            --enable-pull-request-preview
            
        # Connect repository (requires GitHub token)
        if ($env:GITHUB_TOKEN) {
            Write-Host "Connecting GitHub repository..." -ForegroundColor Yellow
            # Note: This requires the GitHub token to be configured
            aws amplify update-app `
                --app-id $APP_ID `
                --oauth-token $env:GITHUB_TOKEN `
                --enable-branch-auto-build
        } else {
            Write-Host "WARNING: GITHUB_TOKEN not found. Please connect repository manually in AWS Console." -ForegroundColor Yellow
        }
        
    } else {
        $APP_ID = $existingApp
        Write-Host "Using existing app: $APP_ID" -ForegroundColor Green
        
        # Update environment variables
        Write-Host "Updating environment variables..." -ForegroundColor Yellow
        aws amplify update-app `
            --app-id $APP_ID `
            --environment-variables @"
NEXT_PUBLIC_AWS_REGION=$env:NEXT_PUBLIC_AWS_REGION
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$env:NEXT_PUBLIC_COGNITO_USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$env:NEXT_PUBLIC_COGNITO_CLIENT_ID
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=$env:NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID
NEXT_PUBLIC_S3_BUCKET=$env:NEXT_PUBLIC_S3_BUCKET
NEXT_PUBLIC_API_GATEWAY_URL=$env:NEXT_PUBLIC_API_GATEWAY_URL
NEXT_PUBLIC_WEBSOCKET_URL=$env:NEXT_PUBLIC_WEBSOCKET_URL
NEXT_PUBLIC_DYNAMODB_USERS_TABLE=$env:NEXT_PUBLIC_DYNAMODB_USERS_TABLE
NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE=$env:NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE
NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE=$env:NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE
NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE=$env:NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE
NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE=$env:NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE
"@
    }
    
    # Trigger deployment
    Write-Host "Triggering deployment..." -ForegroundColor Green
    $JOB = aws amplify start-deployment `
        --app-id $APP_ID `
        --branch-name main `
        --source-url $REPO_URL `
        --query 'jobSummary' `
        --output json | ConvertFrom-Json
    
    $JOB_ID = $JOB.jobId
    Write-Host "Deployment started with Job ID: $JOB_ID" -ForegroundColor Green
    
    # Get the app domain
    $DOMAIN = aws amplify get-app `
        --app-id $APP_ID `
        --query 'app.defaultDomain' `
        --output text
    
    Write-Host "" 
    Write-Host "Amplify deployment triggered successfully!" -ForegroundColor Green
    Write-Host "App URL: https://main.$DOMAIN" -ForegroundColor Cyan
    Write-Host "Check status at: https://console.aws.amazon.com/amplify/home?region=$AWS_REGION#/$APP_ID" -ForegroundColor Cyan
    
} elseif ($DeploymentType -eq "ecs") {
    Write-Host "Deploying to ECS..." -ForegroundColor Cyan
    
    # Docker build and push logic would go here
    Write-Host "ECS deployment requires Docker. Please ensure Docker Desktop is running." -ForegroundColor Yellow
    
    $ECR_REPOSITORY = "chatapp"
    $AWS_ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
    
    # Build Docker image
    Write-Host "Building Docker image..." -ForegroundColor Yellow
    docker build -t ${ECR_REPOSITORY}:latest .
    
    # Login to ECR
    Write-Host "Logging into ECR..." -ForegroundColor Yellow
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    
    # Create repository if it doesn't exist
    aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION 2>$null
    if ($LASTEXITCODE -ne 0) {
        aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
    }
    
    # Push image
    Write-Host "Pushing image to ECR..." -ForegroundColor Yellow
    docker tag ${ECR_REPOSITORY}:latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${ECR_REPOSITORY}:latest"
    docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${ECR_REPOSITORY}:latest"
    
    Write-Host "ECS deployment complete!" -ForegroundColor Green
    
} else {
    Write-Host "ERROR: Invalid deployment type. Use 'amplify' or 'ecs'" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deployment process complete!" -ForegroundColor Green
