import { NextRequest, NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateSecretHash(username: string, clientId: string, clientSecret: string): string {
  const hmac = createHmac('sha256', clientSecret);
  hmac.update(username + clientId);
  return hmac.digest('base64');
}

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and confirmation code are required' },
        { status: 400 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    const clientSecret = process.env.COGNITO_CLIENT_SECRET || 'ehdqjt0ljio1nd37kthmnidrmfuj95lgl87cqm2j7idrqfhv56g';

    const secretHash = clientSecret ? generateSecretHash(email, clientId, clientSecret) : undefined;

    const confirmCommand = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      SecretHash: secretHash
    });

    await cognitoClient.send(confirmCommand);

    return NextResponse.json(
      { message: 'User confirmed successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Confirmation error:', error);
    const err = error as any;
    return NextResponse.json(
      { error: err.message || 'Confirmation failed' },
      { status: 500 }
    );
  }
}
