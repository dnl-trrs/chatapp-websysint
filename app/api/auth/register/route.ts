import { NextRequest, NextResponse } from 'next/server';
import { COGNITO_CONFIG, DYNAMODB_CONFIG, getAWSRegion, getServerAWSCredentials } from '@/lib/aws/unified-config';
import { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
const credentials = getServerAWSCredentials();
const dbClient = new DynamoDBClient({
  region: getAWSRegion(),
  credentials
});

const docClient = DynamoDBDocumentClient.from(dbClient);
const USERS_TABLE = DYNAMODB_CONFIG.tables.users;

const cognitoClient = new CognitoIdentityProviderClient({
  region: getAWSRegion(),
  credentials
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

    const clientId = COGNITO_CONFIG.clientId;
    const userPoolId = COGNITO_CONFIG.userPoolId;

    // Generate a unique non-email username for Cognito (since pool uses email alias)
    const cognitoUsername = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use generated username for Cognito (users will login with email)
    const signUpCommand = new SignUpCommand({
      ClientId: clientId,
      Username: cognitoUsername,
      Password: password,
      // No SecretHash needed for public client
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
        Username: cognitoUsername
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
