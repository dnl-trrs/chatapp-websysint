/**
 * Centralized AWS configuration helpers shared across scripts and server code.
 * Values are primarily sourced from environment variables so deployments can
 * override them without changing code.
 */

const resolveValue = (keys: string[], fallback = ''): string => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return fallback;
};

export const AWS_REGION = resolveValue(
  ['NEXT_PUBLIC_AWS_REGION', 'AWS_REGION', 'AWS_DEFAULT_REGION'],
  'us-east-2'
);

export const AWS_ACCOUNT_ID = resolveValue(['AWS_ACCOUNT_ID', 'NEXT_PUBLIC_AWS_ACCOUNT_ID']);

export const COGNITO_CONFIG = {
  region: AWS_REGION,
  userPoolId: resolveValue(
    ['NEXT_PUBLIC_COGNITO_USER_POOL_ID', 'COGNITO_USER_POOL_ID']
  ),
  clientId: resolveValue(
    ['NEXT_PUBLIC_COGNITO_CLIENT_ID', 'COGNITO_CLIENT_ID']
  ),
  domain: resolveValue(['NEXT_PUBLIC_COGNITO_DOMAIN', 'COGNITO_DOMAIN'])
};

export const DYNAMODB_CONFIG = {
  region: AWS_REGION,
  tables: {
    users: resolveValue(
      ['NEXT_PUBLIC_DYNAMODB_USERS_TABLE', 'DYNAMODB_USERS_TABLE', 'USERS_TABLE_NAME'],
      'chatapp-users'
    ),
    conversations: resolveValue(
      [
        'NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE',
        'DYNAMODB_CONVERSATIONS_TABLE',
        'CONVERSATIONS_TABLE_NAME'
      ],
      'chatapp-conversations'
    ),
    messages: resolveValue(
      ['NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE', 'DYNAMODB_MESSAGES_TABLE', 'MESSAGES_TABLE_NAME'],
      'chatapp-messages'
    ),
    friends: resolveValue(
      ['NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE', 'DYNAMODB_FRIENDS_TABLE', 'FRIENDS_TABLE_NAME'],
      'chatapp-friends'
    ),
    friendRequests: resolveValue(
      [
        'NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE',
        'DYNAMODB_FRIEND_REQUESTS_TABLE',
        'FRIEND_REQUESTS_TABLE_NAME'
      ],
      'chatapp-friend-requests'
    )
  }
};

const resolvedBucket = resolveValue(
  ['S3_BUCKET_NAME', 'NEXT_PUBLIC_S3_BUCKET', 'UPLOADS_BUCKET_NAME'],
  ''
);

export const S3_CONFIG = {
  region: AWS_REGION,
  bucketName: resolvedBucket,
  publicUrlBase: resolvedBucket ? `https://${resolvedBucket}.s3.${AWS_REGION}.amazonaws.com` : null
};

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
  'NEXT_PUBLIC_COGNITO_CLIENT_ID',
  'NEXT_PUBLIC_S3_BUCKET'
];

export const isAWSConfigured = (): boolean => {
  return REQUIRED_ENV_VARS.every(key => {
    const value = process.env[key];
    return Boolean(value && value.trim().length > 0);
  });
};

export const getAWSRegion = (): string => AWS_REGION;
