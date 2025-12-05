import { NextRequest, NextResponse } from 'next/server';
import { COGNITO_CONFIG, getAWSRegion, getServerAWSCredentials } from '@/lib/aws/unified-config';
import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';

// Generate SECRET_HASH for Cognito
function generateSecretHash(username: string, clientId: string, clientSecret: string): string {
  const hmac = createHmac('sha256', clientSecret);
  hmac.update(username + clientId);
  return hmac.digest('base64');
}

const credentials = getServerAWSCredentials();
const cognitoClient = new CognitoIdentityProviderClient({
  region: getAWSRegion(),
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey
  }
});

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const clientId = COGNITO_CONFIG.clientId;
    const clientSecret = process.env.COGNITO_CLIENT_SECRET || '';

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Client secret not configured' },
        { status: 500 }
      );
    }

    // Generate SECRET_HASH
    const secretHash = generateSecretHash(email, clientId, clientSecret);

    // Initiate auth with USERNAME_PASSWORD_AUTH flow
    const authCommand = new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash
      }
    });

    const authResponse = await cognitoClient.send(authCommand);

    // Check if we need to respond to a challenge
    if (authResponse.ChallengeName) {
      return NextResponse.json(
        {
          error: `Authentication challenge required: ${authResponse.ChallengeName}`,
          challengeName: authResponse.ChallengeName,
          session: authResponse.Session
        },
        { status: 401 }
      );
    }

    // Successful authentication
    if (!authResponse.AuthenticationResult) {
      return NextResponse.json(
        { error: 'No authentication result' },
        { status: 500 }
      );
    }

    const { AccessToken, IdToken, RefreshToken } = authResponse.AuthenticationResult;

    // Return tokens to client
    return NextResponse.json(
      {
        success: true,
        accessToken: AccessToken,
        idToken: IdToken,
        refreshToken: RefreshToken
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    const err = error as any;
    
    // Handle specific Cognito errors
    if (err.name === 'UserNotFoundException') {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    if (err.name === 'NotAuthorizedException') {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    if (err.name === 'UserNotConfirmedException') {
      return NextResponse.json(
        { error: 'User account is not confirmed' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: err.message || 'Login failed' },
      { status: 500 }
    );
  }
}
