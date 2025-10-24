# AWS Deployment Guide

This guide provides instructions for deploying the Chat Application to AWS. The app includes a **beta notice banner** to inform users that this is an unfinished product.

## 🎯 Deployment Options

### Option 1: AWS Amplify (Recommended for Quick Setup)

AWS Amplify provides the easiest way to deploy Next.js applications with automatic CI/CD.

#### Prerequisites
- AWS Account with Amplify access
- GitHub repository connected to AWS
- AWS CLI configured

#### Steps

1. **Connect your GitHub repository to AWS Amplify Console:**
   ```bash
   # Visit AWS Amplify Console
   https://console.aws.amazon.com/amplify/
   
   # Click "New app" > "Host web app"
   # Select GitHub and authorize access
   # Select your repository and branch
   ```

2. **Configure build settings:**
   - Amplify will auto-detect Next.js
   - The `amplify.yml` file in the repo will be used automatically

3. **Set environment variables in Amplify Console:**
   ```
   NEXT_PUBLIC_AWS_REGION=us-east-2
   NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-user-pool-id
   NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
   NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=your-identity-pool-id
   NEXT_PUBLIC_S3_BUCKET=your-s3-bucket
   NEXT_PUBLIC_API_GATEWAY_URL=your-api-gateway-url
   NEXT_PUBLIC_WEBSOCKET_URL=your-websocket-url
   NEXT_PUBLIC_DYNAMODB_USERS_TABLE=chatapp-users
   NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE=chatapp-conversations
   NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE=chatapp-messages
   NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE=chatapp-friends
   NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE=chatapp-friend-requests
   ```

4. **Deploy:**
   ```bash
   # Using the provided script
   ./scripts/deploy-aws.sh amplify staging
   ```

5. **Access your app:**
   - URL format: `https://main.{app-id}.amplifyapp.com`

### Option 2: ECS with Fargate

For more control over the infrastructure, use Amazon ECS with Fargate.

#### Prerequisites
- AWS CLI configured
- Docker installed
- ECR repository created
- ECS cluster and service configured

#### Initial Setup

1. **Create ECR repository:**
   ```bash
   aws ecr create-repository --repository-name chatapp --region us-east-1
   ```

2. **Create ECS cluster:**
   ```bash
   aws ecs create-cluster --cluster-name chatapp-cluster
   ```

3. **Store secrets in AWS Secrets Manager (optional for sensitive values):**
   ```bash
   aws secretsmanager create-secret \
     --name chatapp/aws-config \
     --secret-string '{
       "NEXT_PUBLIC_AWS_REGION":"us-east-2",
       "NEXT_PUBLIC_COGNITO_USER_POOL_ID":"your-user-pool-id",
       "NEXT_PUBLIC_COGNITO_CLIENT_ID":"your-client-id",
       "NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID":"your-identity-pool-id",
       "NEXT_PUBLIC_S3_BUCKET":"your-s3-bucket",
       "NEXT_PUBLIC_API_GATEWAY_URL":"your-api-url",
       "NEXT_PUBLIC_WEBSOCKET_URL":"your-ws-url"
     }'
   ```

4. **Deploy using the script:**
   ```bash
   ./scripts/deploy-aws.sh ecs production
   ```

### Option 3: Manual Docker Deployment

For testing or custom deployments:

1. **Build the Docker image:**
   ```bash
   docker build -t chatapp:latest .
   ```

2. **Test locally:**
   ```bash
   docker-compose up
   ```

3. **Push to ECR and deploy:**
   ```bash
   # Tag and push
   docker tag chatapp:latest {account-id}.dkr.ecr.{region}.amazonaws.com/chatapp:latest
   docker push {account-id}.dkr.ecr.{region}.amazonaws.com/chatapp:latest
   ```

## 🔧 Environment Configuration

Create environment files for different stages:

### `.env.staging`
```env
NEXT_PUBLIC_AWS_REGION=us-east-2
NEXT_PUBLIC_COGNITO_USER_POOL_ID=staging-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=staging-client-id
NEXT_PUBLIC_API_GATEWAY_URL=https://staging-api.execute-api.us-east-2.amazonaws.com/prod
# ... other staging configs
```

### `.env.production`
```env
NEXT_PUBLIC_AWS_REGION=us-east-2
NEXT_PUBLIC_COGNITO_USER_POOL_ID=production-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=production-client-id
NEXT_PUBLIC_API_GATEWAY_URL=https://production-api.execute-api.us-east-2.amazonaws.com/prod
# ... other production configs
```

## 🚨 Beta Notice

The application automatically displays a beta notice banner at the top of every page. Users can dismiss it for their session, but it will reappear on new sessions. This banner:

- Warns users that the app is in development
- Can be dismissed per session
- Uses an amber/orange color scheme for visibility
- Includes an alert icon for emphasis

To modify the beta notice, edit `components/BetaBanner.tsx`.

## 📊 Monitoring

### CloudWatch Logs
- ECS logs: `/ecs/chatapp`
- Amplify logs: Available in Amplify Console

### Health Checks
- ECS: Configured in task definition
- Amplify: Automatic health monitoring

## 🔒 Security Considerations

1. **Never commit `.env` files** to version control
2. **Use AWS Secrets Manager** for sensitive data
3. **Enable HTTPS** (automatic with Amplify, configure ALB for ECS)
4. **Set up proper IAM roles** with minimum required permissions

## 🛠️ Troubleshooting

### Common Issues

1. **Build fails in Amplify:**
   - Check Node version compatibility
   - Verify all environment variables are set
   - Review build logs in Amplify Console

2. **ECS task fails to start:**
   - Check CloudWatch logs
   - Verify secrets are properly configured
   - Ensure health check endpoint is accessible

3. **Docker build fails locally:**
   - Clear Docker cache: `docker system prune -a`
   - Ensure `package-lock.json` is up to date
   - Check Node version in Dockerfile

## 📈 Scaling

### Amplify
- Automatic scaling based on traffic
- Configure in Amplify Console

### ECS
- Configure auto-scaling policies:
  ```bash
  aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id service/chatapp-cluster/chatapp-service \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 1 \
    --max-capacity 10
  ```

## 🔄 Updating the Application

1. **Push changes to GitHub**
2. **Amplify:** Automatic deployment on push
3. **ECS:** Run `./scripts/deploy-aws.sh ecs production`

## 📝 Next Steps

1. Set up custom domain
2. Configure CDN (CloudFront)
3. Implement comprehensive monitoring
4. Add automated testing in CI/CD pipeline
5. Migrate from Firebase to AWS services (DynamoDB, Cognito, etc.)

---

For questions or issues, please refer to the main [README.md](README.md) or [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md).