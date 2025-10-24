import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

// AWS Configuration
export const AWS_CONFIG = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  userPoolWebClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID,
  s3Bucket: process.env.NEXT_PUBLIC_S3_BUCKET || 'chatapp-uploads-082187380736'
};

// Check if AWS is configured
export const isAWSConfigured = () => {
  return !!(
    AWS_CONFIG.userPoolId && 
    AWS_CONFIG.userPoolWebClientId
  );
};

// Get AWS credentials for authenticated users
export const getAWSCredentials = (idToken?: string) => {
  // For authenticated users with Cognito Identity Pool
  if (AWS_CONFIG.identityPoolId && idToken) {
    const cognitoIdentity = new CognitoIdentityClient({
      region: AWS_CONFIG.region,
    });

    return fromCognitoIdentityPool({
      client: cognitoIdentity,
      identityPoolId: AWS_CONFIG.identityPoolId,
      logins: {
        [`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`]: idToken
      }
    });
  }

  // For unauthenticated access (if Identity Pool allows it)
  if (AWS_CONFIG.identityPoolId) {
    const cognitoIdentity = new CognitoIdentityClient({
      region: AWS_CONFIG.region,
    });

    return fromCognitoIdentityPool({
      client: cognitoIdentity,
      identityPoolId: AWS_CONFIG.identityPoolId
    });
  }

  // Fallback to environment variables (development only)
  if (process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID && process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
    };
  }

  throw new Error('AWS credentials not configured');
};

export default AWS_CONFIG;