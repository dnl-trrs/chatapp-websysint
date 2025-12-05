# Delete all users from DynamoDB table
$tableName = "chatapp-users"
$region = "us-east-2"

Write-Host "Scanning table $tableName for all users..."

# Get all user IDs
$scanResult = aws dynamodb scan `
  --table-name $tableName `
  --region $region `
  --projection-expression "userId" `
  --output json | ConvertFrom-Json

$userIds = $scanResult.Items | ForEach-Object { $_.userId.S }
$count = $userIds.Count

if ($count -eq 0) {
    Write-Host "No users found in the table."
    exit 0
}

Write-Host "Found $count users. Deleting all users..."

$deleted = 0
foreach ($userId in $userIds) {
    aws dynamodb delete-item `
      --table-name $tableName `
      --region $region `
      --key "userId={S=$userId}" `
      --output none
    
    $deleted++
    Write-Host "Deleted user $deleted/$count: $userId"
}

Write-Host "Successfully deleted all $count users from $tableName"
