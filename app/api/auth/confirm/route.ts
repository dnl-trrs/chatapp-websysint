import { NextRequest, NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateSecretHash(username: string, clientId: string, clientSecret?: string): string | undefined {
  if (!clientSecret) return undefined;
  const hmac = createHmac('sha256', clientSecret);
  hmac.update(username + clientId);
  return hmac.digest('base64');
}

const cognitoConfig: any = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2'
};
const akid = process.env.AMPLIFY_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const sak = process.env.AMPLIFY_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
if (akid && sak) {
  cognitoConfig.credentials = { accessKeyId: akid, secretAccessKey: sak };
}
const cognitoClient = new CognitoIdentityProviderClient(cognitoConfig);

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
    const clientSecret = process.env.COGNITO_CLIENT_SECRET; // optional if app client has no secret

    const secretHash = generateSecretHash(email, clientId, clientSecret);

    const confirmCommand = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      ...(secretHash ? { SecretHash: secretHash } : {})
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
