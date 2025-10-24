# PowerShell script to setup S3 bucket for profile photos
# Run this script once to configure your S3 bucket

$bucketName = "chatapp-uploads-082187380736"
$region = "us-east-2"

Write-Host "Setting up S3 bucket: $bucketName" -ForegroundColor Green

# 1. Create bucket if it doesn't exist
Write-Host "Checking if bucket exists..."
$bucketExists = aws s3api head-bucket --bucket $bucketName 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating bucket..."
    aws s3api create-bucket --bucket $bucketName --region $region --create-bucket-configuration LocationConstraint=$region
} else {
    Write-Host "Bucket already exists"
}

# 2. Block Public Access Settings - Allow public read
Write-Host "Configuring public access settings..." -ForegroundColor Yellow
aws s3api put-public-access-block `
    --bucket $bucketName `
    --public-access-block-configuration `
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# 3. Create bucket policy for public read access
Write-Host "Setting bucket policy for public read access..." -ForegroundColor Yellow
$bucketPolicy = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$bucketName/*"
        }
    ]
}
"@

$bucketPolicy | Out-File -FilePath "bucket-policy.json" -Encoding UTF8
aws s3api put-bucket-policy --bucket $bucketName --policy file://bucket-policy.json
Remove-Item "bucket-policy.json"

# 4. Configure CORS for browser uploads
Write-Host "Configuring CORS..." -ForegroundColor Yellow
$corsConfig = @"
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001", "https://*.vercel.app"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
"@

$corsConfig | Out-File -FilePath "cors-config.json" -Encoding UTF8
aws s3api put-bucket-cors --bucket $bucketName --cors-configuration file://cors-config.json
Remove-Item "cors-config.json"

Write-Host "S3 bucket setup complete!" -ForegroundColor Green
Write-Host "Bucket URL: https://$bucketName.s3.$region.amazonaws.com" -ForegroundColor Cyan