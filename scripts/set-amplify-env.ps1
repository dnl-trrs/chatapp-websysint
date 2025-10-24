# Set environment variables for Amplify app
param(
    [Parameter(Mandatory=$true)]
    [string]$AppId
)

# Read .env.local and build environment variables JSON
$envVars = @{}

Get-Content .env.local | ForEach-Object {
    if ($_ -match '^(NEXT_PUBLIC_[^=]+)=(.*)$') {
        $key = $matches[1]
        $value = $matches[2]
        $envVars[$key] = $value
    }
}

# Convert to JSON string for AWS CLI
$envJson = $envVars | ConvertTo-Json -Compress

# Update the app with proper environment variables
Write-Host "Setting environment variables for Amplify app: $AppId"
$envJson | Out-File -FilePath temp-env.json -Encoding UTF8

aws amplify update-app `
    --app-id $AppId `
    --environment-variables file://temp-env.json `
    --region us-east-2

Remove-Item temp-env.json

Write-Host "Environment variables set successfully!"