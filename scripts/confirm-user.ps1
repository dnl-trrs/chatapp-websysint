# Script to confirm a Cognito user for testing purposes
# Usage: .\confirm-user.ps1 -Email "user@example.com"

param(
    [Parameter(Mandatory=$true)]
    [string]$Email
)

$UserPoolId = "us-east-2_ZjwO0AaGH"
$Region = "us-east-2"

Write-Host "Confirming user: $Email" -ForegroundColor Yellow

# Confirm the user
aws cognito-idp admin-confirm-sign-up `
    --user-pool-id $UserPoolId `
    --username $Email `
    --region $Region

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ User $Email has been confirmed successfully!" -ForegroundColor Green
    
    # Also set user attributes to mark email as verified
    aws cognito-idp admin-update-user-attributes `
        --user-pool-id $UserPoolId `
        --username $Email `
        --user-attributes Name=email_verified,Value=true `
        --region $Region
        
    Write-Host "✓ Email marked as verified!" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to confirm user" -ForegroundColor Red
}

Write-Host ""
Write-Host "User can now log in with their email and password." -ForegroundColor Cyan