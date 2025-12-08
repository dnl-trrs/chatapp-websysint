import { NextRequest, NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHmac } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Generate SECRET_HASH for Cognito
function generateSecretHash(username: string, clientId: string, clientSecret?: string): string | undefined {
  if (!clientSecret) return undefined;
  const hmac = createHmac('sha256', clientSecret);
  hmac.update(username + clientId);
  return hmac.digest('base64');
}

// Initialize DynamoDB client
// Relies on IAM Role in production (Amplify) or custom env vars if role is restricted
const dbClientConfig: any = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  maxAttempts: 3
};

// Check for custom credentials (workaround for Amplify UI restriction on AWS_ prefix)
const accessKeyId = process.env.AMPLIFY_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AMPLIFY_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

if (accessKeyId && secretAccessKey) {
  dbClientConfig.credentials = {
    accessKeyId,
    secretAccessKey
  };
}

const dbClient = new DynamoDBClient(dbClientConfig);

const docClient = DynamoDBDocumentClient.from(dbClient);
const USERS_TABLE =
  process.env.NEXT_PUBLIC_DYNAMODB_USERS_TABLE ||
  process.env.DYNAMODB_USERS_TABLE ||
  process.env.USERS_TABLE_NAME ||
  'chatapp-users';

const cognitoClientConfig: any = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2'
};

if (accessKeyId && secretAccessKey) {
  cognitoClientConfig.credentials = {
    accessKeyId,
    secretAccessKey
  };
}

const cognitoClient = new CognitoIdentityProviderClient(cognitoClientConfig);

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, displayName } = await request.json();

    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedDisplayName = typeof displayName === 'string'
      ? displayName.trim()
      : typeof username === 'string'
        ? username.trim()
        : '';

    if (!trimmedEmail || !password || !trimmedDisplayName) {
      return NextResponse.json(
        { error: 'Email, password, and display name are required' },
        { status: 400 }
      );
    }

    const emailLower = trimmedEmail.toLowerCase();
    const normalizedHandleBase = trimmedDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const emailHandleFallback = trimmedEmail.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    const normalizedHandle = (normalizedHandleBase || emailHandleFallback || 'user').slice(0, 32);
    const displayNameLower = trimmedDisplayName.toLowerCase();

    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    const clientSecret = process.env.COGNITO_CLIENT_SECRET; // optional if app client has no secret

    // Generate SECRET_HASH if client secret is configured
    const secretHash = generateSecretHash(email, clientId, clientSecret);

    // Use email as Cognito username
    const signUpCommand = new SignUpCommand({
      ClientId: clientId,
      Username: trimmedEmail,
      Password: password,
      ...(secretHash ? { SecretHash: secretHash } : {}),
      UserAttributes: [
        { Name: 'email', Value: trimmedEmail },
        { Name: 'name', Value: trimmedDisplayName }
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

    // Create user in DynamoDB with retry
    let userCreated = false;
    let userData = null;
    
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const putCommand = new PutCommand({
          TableName: USERS_TABLE,
          Item: {
            userId,
            email: trimmedEmail,
            emailLower,
            displayName: trimmedDisplayName,
            displayNameLower,
            username: normalizedHandle,
            usernameLower: normalizedHandle,
            photoURL: '',
            bio: '',
            status: 'online',
            emailVerified: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        });
        await docClient.send(putCommand);
        
        // Verify write by reading back
        const getCommand = new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId }
        });
        const getResult = await docClient.send(getCommand);
        userData = getResult.Item;
        
        if (userData && userData.displayName && userData.username) {
          userCreated = true;
          console.log('User created and verified in DynamoDB:', userData);
          break;
        } else {
          console.warn('User created but fields missing, attempt', attempt + 1);
          if (attempt === 0) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      } catch (dbErr: any) {
        console.error('Error creating user in DynamoDB (attempt ' + (attempt + 1) + '):', dbErr?.code || dbErr);
        if (attempt === 0 && dbErr?.name === 'ProvisionedThroughputExceededException') {
          // Retry on throughput error
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    return NextResponse.json(
      { 
        userId, 
        email: trimmedEmail, 
        username: normalizedHandle,
        displayName: trimmedDisplayName,
        userCreated,
        userData
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    const err = error as any;
    return NextResponse.json(
      { error: err.message || 'Registration failed', code: err?.code },
      { status: 500 }
    );
  }
}
