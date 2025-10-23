# Secure AWS Configuration Script
# This script will prompt you for AWS credentials without displaying them

$awsPath = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

Write-Host "AWS Configuration Setup" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""

# Prompt for Access Key ID
$accessKey = Read-Host -Prompt "Enter your AWS Access Key ID"

# Prompt for Secret Access Key (hidden input)
$secretKey = Read-Host -Prompt "Enter your AWS Secret Access Key" -AsSecureString

# Convert secure string to plain text for AWS CLI
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey)
$secretKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Set the region
$region = Read-Host -Prompt "Enter your AWS Region (press Enter for default: us-east-1)"
if ([string]::IsNullOrWhiteSpace($region)) {
    $region = "us-east-1"
}

# Configure AWS CLI
& $awsPath configure set aws_access_key_id $accessKey
& $awsPath configure set aws_secret_access_key $secretKeyPlain
& $awsPath configure set region $region
& $awsPath configure set output json

# Clear sensitive variables
$secretKeyPlain = $null
$BSTR = $null
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

Write-Host ""
Write-Host "AWS CLI configured successfully!" -ForegroundColor Green
Write-Host ""

# Test the configuration
Write-Host "Testing AWS configuration..." -ForegroundColor Yellow
& $awsPath sts get-caller-identity

Write-Host ""
Write-Host "If you see your AWS account info above, the configuration is working!" -ForegroundColor Cyan