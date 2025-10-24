# Quick Deploy with AWS CLI

Deploy your chat app to AWS Amplify using the command line in just a few steps!

## Prerequisites

1. **AWS CLI installed and configured**
   ```powershell
   aws configure
   # Enter your AWS Access Key ID, Secret Key, and region (us-east-2)
   ```

2. **GitHub repository** 
   - Push your code to GitHub
   - Generate a Personal Access Token: GitHub Settings → Developer settings → Personal access tokens

## Deploy in 3 Steps

### Step 1: Update Repository URL
Edit `scripts\deploy-aws.ps1` and update line 13 with your GitHub repo:
```powershell
$REPO_URL = "https://github.com/YOUR_USERNAME/chatapp-websysint"
```

### Step 2: Set GitHub Token (Optional for auto-connect)
```powershell
$env:GITHUB_TOKEN = "your-github-personal-access-token"
```

### Step 3: Run Deployment
```powershell
# From your project root directory
.\scripts\deploy-aws.ps1 -DeploymentType amplify -Environment production
```

## What Happens

The script will:
1. ✅ Load your AWS credentials from `.env.local`
2. ✅ Create an Amplify app named `chatapp-production`
3. ✅ Configure all environment variables automatically
4. ✅ Set up the build process using `amplify.yml`
5. ✅ Trigger the first deployment
6. ✅ Give you the app URL

## First Deployment

After running the script:
1. If no GitHub token was provided, go to AWS Amplify Console to connect your repo
2. The first build will start automatically once connected
3. Your app will be live at: `https://main.{app-id}.amplifyapp.com`

## Monitor Deployment

```powershell
# Get deployment status
aws amplify get-job --app-id YOUR_APP_ID --branch-name main --job-id YOUR_JOB_ID

# List all apps
aws amplify list-apps

# Get app details
aws amplify get-app --app-id YOUR_APP_ID
```

## Update Environment Variables

```powershell
# Update a single variable
aws amplify update-app --app-id YOUR_APP_ID `
  --environment-variables "NEXT_PUBLIC_API_GATEWAY_URL=new-value"

# Or run the script again - it will update existing apps
.\scripts\deploy-aws.ps1
```

## Troubleshooting

### "Command not found"
Make sure AWS CLI is installed:
```powershell
winget install Amazon.AWSCLI
# or
choco install awscli
```

### "Access Denied"
Check your AWS credentials:
```powershell
aws sts get-caller-identity
```

### Build Fails
Check logs in Amplify Console or:
```powershell
aws amplify get-job --app-id YOUR_APP_ID --branch-name main --job-id YOUR_JOB_ID
```

## Features Included

- ✅ **Beta Notice Banner** - Warns users the app is in development
- ✅ **AWS Services** - Uses Cognito, DynamoDB, S3, API Gateway
- ✅ **Auto-scaling** - Amplify handles traffic automatically
- ✅ **HTTPS** - SSL certificate included
- ✅ **CI/CD** - Auto-deploys on git push

## Next Steps

1. **Custom Domain**: Add your domain in Amplify Console
2. **Monitoring**: Set up CloudWatch alarms
3. **Staging Environment**: Run with `-Environment staging`

---

**Quick Command Reference:**
```powershell
# Deploy to production
.\scripts\deploy-aws.ps1

# Deploy to staging
.\scripts\deploy-aws.ps1 -Environment staging

# Deploy using Docker/ECS instead
.\scripts\deploy-aws.ps1 -DeploymentType ecs
```