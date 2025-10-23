// AWS Configuration
export const awsConfig = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
  cognito: {
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
  },
  dynamodb: {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
    tables: {
      users: process.env.NEXT_PUBLIC_DYNAMODB_USERS_TABLE || 'chatapp-users',
      conversations: process.env.NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE || 'chatapp-conversations',
      messages: process.env.NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE || 'chatapp-messages',
      friends: process.env.NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE || 'chatapp-friends',
      friendRequests: process.env.NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE || 'chatapp-friend-requests',
    }
  },
  s3: {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
    bucketName: process.env.NEXT_PUBLIC_S3_BUCKET || 'chatapp-uploads',
  },
  apiGateway: {
    restApiUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || '',
    websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || '',
  }
};

// Helper to check if AWS is configured
export const isAWSConfigured = () => {
  return !!(
    awsConfig.cognito.userPoolId &&
    awsConfig.cognito.clientId
  );
};

// Helper to check if using Firebase fallback
export const useFirebaseFallback = () => {
  return !isAWSConfigured();
};