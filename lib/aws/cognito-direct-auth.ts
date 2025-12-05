// Direct Cognito API authentication (avoids amazon-cognito-identity-js SECRET_HASH issues)
import { CognitoIdentityProviderClient, InitiateAuthCommand, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2'
});

export interface DirectAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export class DirectCognitoAuth {
  static async signIn(email: string, password: string): Promise<{ idToken: string; accessToken: string; refreshToken: string }> {
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    
    try {
      const command = new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        throw new Error('No authentication result');
      }

      return {
        idToken: response.AuthenticationResult.IdToken || '',
        accessToken: response.AuthenticationResult.AccessToken || '',
        refreshToken: response.AuthenticationResult.RefreshToken || '',
      };
    } catch (error: any) {
      console.error('Direct Cognito auth error:', error);
      throw error;
    }
  }

  static async getCurrentUserFromToken(accessToken: string): Promise<DirectAuthUser | null> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await cognitoClient.send(command);
      
      const emailAttr = response.UserAttributes?.find(attr => attr.Name === 'email');
      const nameAttr = response.UserAttributes?.find(attr => attr.Name === 'name');
      const subAttr = response.UserAttributes?.find(attr => attr.Name === 'sub');
      const emailVerifiedAttr = response.UserAttributes?.find(attr => attr.Name === 'email_verified');

      return {
        uid: subAttr?.Value || '',
        email: emailAttr?.Value || null,
        displayName: nameAttr?.Value || null,
        photoURL: null,
        emailVerified: emailVerifiedAttr?.Value === 'true',
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }
}
