/**
 * Unified AWS Configuration
 * Single source of truth for all AWS resource IDs and credentials
 */

// Account and Region
export const AWS_ACCOUNT_ID = '082187380736';
export const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2';

// Cognito User Pool Configuration (using direct API, no Identity Pool needed)
export const COGNITO_CONFIG = {
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-2_HfHe0x0Mt',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '71etpmo20vll5a4nu77mtvi5cm',
  region: AWS_REGION,
};

// DynamoDB Configuration
export const DYNAMODB_CONFIG = {
  region: AWS_REGION,
  tables: {
    users: process.env.NEXT_PUBLIC_DYNAMODB_USERS_TABLE || 'chatapp-users',
    conversations: process.env.NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE || 'chatapp-conversations',
    messages: process.env.NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE || 'chatapp-messages',
    friends: process.env.NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE || 'chatapp-friends',
    friendRequests: process.env.NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE || 'chatapp-friend-requests',
  },
};

// S3 Configuration
export const S3_CONFIG = {
  region: AWS_REGION,
  bucketName: process.env.NEXT_PUBLIC_S3_BUCKET || 'chatapp-uploads-082187380736',
};

// API Gateway Configuration (if applicable)
export const API_GATEWAY_CONFIG = {
  restApiUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || '',
  websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || '',
};

// Server-side AWS credentials (for backend operations)
export const getServerAWSCredentials = () => {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  };
};

export const getAWSRegion = () => {
  return AWS_REGION;
};

// Validation function to check if essential AWS config is present
export const isAWSConfigured = (): boolean => {
  return !!(
    COGNITO_CONFIG.userPoolId &&
    COGNITO_CONFIG.clientId
  );
};

export default {
  AWS_ACCOUNT_ID,
  AWS_REGION,
  COGNITO_CONFIG,
  DYNAMODB_CONFIG,
  S3_CONFIG,
  API_GATEWAY_CONFIG,
  getServerAWSCredentials,
  getAWSRegion,
  isAWSConfigured,
};
