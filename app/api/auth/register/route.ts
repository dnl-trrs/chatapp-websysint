import { NextRequest, NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createHmac } from 'crypto';

// Generate SECRET_HASH for Cognito
function generateSecretHash(username: string, clientId: string, clientSecret: string): string {
  const hmac = createHmac('sha256', clientSecret);
  hmac.update(username + clientId);
  return hmac.digest('base64');
}

const dbClient = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const docClient = DynamoDBDocumentClient.from(dbClient);
const USERS_TABLE = 'chatapp-users';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

export async function POST(request: NextRequest) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: 'Email, password, and username are required' },
        { status: 400 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    const clientSecret = process.env.COGNITO_CLIENT_SECRET || '';

    // Generate SECRET_HASH if client secret is configured
    const secretHash = clientSecret ? generateSecretHash(email, clientId, clientSecret) : undefined;

    // Use email as Cognito username
    const signUpCommand = new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: password,
      SecretHash: secretHash,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: username }
      ]
    });

    const signUpResponse = await cognitoClient.send(signUpCommand);
    const userId = signUpResponse.UserSub;

    if (!userId) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Admin confirm the user (dev convenience - auto-confirms without email verification)
    try {
      const confirmCommand = new AdminConfirmSignUpCommand({
        UserPoolId: userPoolId,
        Username: email
      });
      await cognitoClient.send(confirmCommand);
    } catch (confirmErr) {
      console.warn('Warning confirming user:', confirmErr);
      // Continue - user may still be usable
    }

    // Create user in DynamoDB
    try {
      const putCommand = new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          userId,
          email,
          displayName: username,
          username: username.toLowerCase(),
          photoURL: '',
          bio: '',
          status: 'online',
          emailVerified: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });
      await docClient.send(putCommand);
    } catch (dbErr) {
      console.error('Error creating user in DynamoDB:', dbErr);
      // Don't fail - user is already in Cognito
    }

    return NextResponse.json(
      { userId, email, username },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    const err = error as any;
    return NextResponse.json(
      { error: err.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
