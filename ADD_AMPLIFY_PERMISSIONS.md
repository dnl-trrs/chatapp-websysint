# Add AWS Amplify Permissions - Quick Guide

You need to add Amplify permissions to your `chatapp-service-user` IAM user. Here are two methods:

## Method 1: AWS Console (Easiest) ✅

1. **Open AWS Console**
   - Go to: https://console.aws.amazon.com/iam/
   - Sign in with your AWS root account or an admin account (NOT chatapp-service-user)

2. **Navigate to your user**
   - Click "Users" in the left sidebar
   - Click on `chatapp-service-user`

3. **Add permissions**
   - Click the "Add permissions" button
   - Choose "Attach policies directly"

4. **Select the Amplify policy**
   - In the search box, type: `Amplify`
   - Check the box next to: **`AdministratorAccess-Amplify`**
   - Click "Next"
   - Click "Add permissions"

5. **Done!** You can now deploy using:
   ```powershell
   .\scripts\deploy-aws.ps1
   ```

## Method 2: Create Custom Policy (More Secure)

If you want more granular permissions:

1. **Go to Policies**
   - In IAM Console, click "Policies" → "Create Policy"

2. **Add the JSON**
   - Click "JSON" tab
   - Copy the entire content from: `aws\amplify-deployment-policy.json`
   - Paste it in the editor

3. **Name and create**
   - Click "Next: Tags" → "Next: Review"
   - Policy name: `ChatAppAmplifyDeployment`
   - Click "Create policy"

4. **Attach to user**
   - Go back to Users → `chatapp-service-user`
   - Add permissions → Attach policies directly
   - Search for `ChatAppAmplifyDeployment`
   - Select it and click "Add permissions"

## Method 3: Using AWS CLI (If you have admin access)

If you have AWS CLI configured with admin/root credentials:

```powershell
# Run the helper script
.\scripts\add-amplify-permissions.ps1
```

## After Adding Permissions

Once permissions are added, run:

```powershell
# Deploy your app!
.\scripts\deploy-aws.ps1 -DeploymentType amplify -Environment production
```

The deployment will:
- Create an Amplify app
- Configure all your AWS services (Cognito, DynamoDB, S3, etc.)
- Deploy your app with the beta notice banner
- Give you a public URL

## Verify Permissions Were Added

To check if permissions were added successfully:

```powershell
aws amplify list-apps --region us-east-2
```

If this command works (returns `{"apps": []}` or lists apps), you have the right permissions!

---

**Need Help?** 
- The simplest option is Method 1 using the AWS Console
- You need AWS root or admin access to add these permissions
- The `AdministratorAccess-Amplify` policy gives all necessary permissions for Amplify