# Script to add Amplify permissions to IAM user
# This requires AWS account root or IAM admin access

param(
    [string]$UserName = "chatapp-service-user"
)

Write-Host "Adding Amplify deployment permissions to IAM user: $UserName" -ForegroundColor Yellow
Write-Host ""

# Check if running with sufficient permissions
Write-Host "Note: This script requires IAM admin permissions." -ForegroundColor Red
Write-Host "If you're running as chatapp-service-user, this will fail." -ForegroundColor Red
Write-Host ""

$choice = Read-Host "Do you have AWS root/admin access? (y/n)"
if ($choice -ne 'y') {
    Write-Host ""
    Write-Host "Please follow these manual steps instead:" -ForegroundColor Cyan
    Write-Host "1. Log into AWS Console with admin/root account"
    Write-Host "2. Go to IAM -> Users -> chatapp-service-user"
    Write-Host "3. Click 'Add permissions' -> 'Attach policies directly'"
    Write-Host "4. Search for and select: AdministratorAccess-Amplify"
    Write-Host "5. Click 'Next' and 'Add permissions'"
    Write-Host ""
    Write-Host "OR create a custom policy:" -ForegroundColor Cyan
    Write-Host "1. Go to IAM -> Policies -> Create Policy"
    Write-Host "2. Choose JSON and paste the content from: aws\amplify-deployment-policy.json"
    Write-Host "3. Name it: ChatAppAmplifyDeployment"
    Write-Host "4. Attach it to chatapp-service-user"
    exit
}

try {
    # Create the policy
    $PolicyName = "ChatAppAmplifyDeployment"
    $PolicyDocument = Get-Content "aws\amplify-deployment-policy.json" -Raw
    
    Write-Host "Creating IAM policy: $PolicyName..." -ForegroundColor Green
    
    $Policy = aws iam create-policy `
        --policy-name $PolicyName `
        --policy-document $PolicyDocument `
        --description "Allows deployment to AWS Amplify for ChatApp" `
        --query 'Policy.Arn' `
        --output text 2>$null
        
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Policy created successfully!" -ForegroundColor Green
    } else {
        # Policy might already exist
        Write-Host "Policy might already exist, getting ARN..." -ForegroundColor Yellow
        $AccountId = aws sts get-caller-identity --query Account --output text
        $Policy = "arn:aws:iam::${AccountId}:policy/$PolicyName"
    }
    
    # Attach the policy to the user
    Write-Host "Attaching policy to user: $UserName..." -ForegroundColor Green
    
    aws iam attach-user-policy `
        --user-name $UserName `
        --policy-arn $Policy
        
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Policy attached successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "SUCCESS! User $UserName now has Amplify deployment permissions." -ForegroundColor Green
        Write-Host "You can now run: .\scripts\deploy-aws.ps1" -ForegroundColor Cyan
    } else {
        Write-Host "Failed to attach policy. Please check your permissions." -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add permissions manually through the AWS Console." -ForegroundColor Yellow
}