// Server-side AWS configuration helper
// Supports both local development (.env.local) and Amplify deployment

export const getAWSCredentials = () => {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.APP_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.APP_AWS_SECRET_ACCESS_KEY!,
  };
};

export const getAWSAccountId = () => {
  return process.env.AWS_ACCOUNT_ID || process.env.APP_AWS_ACCOUNT_ID || '';
};

export const getAWSRegion = () => {
  return process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2';
};