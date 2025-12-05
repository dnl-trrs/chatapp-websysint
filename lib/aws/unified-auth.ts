// Unified Auth Service - AWS Cognito only (using direct API)
import * as auth from './auth';
import { isAWSConfigured } from './config';

// Unified user type
export interface UnifiedAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export class UnifiedAuthService {
  private static useAWS = isAWSConfigured();

  // Sign in existing user
  static async signIn(email: string, password: string): Promise<UnifiedAuthUser> {
    return auth.signInUser(email, password);
  }

  // Sign out current user
  static async signOut(): Promise<void> {
    return auth.signOutUser();
  }

  // Get current user
  static async getCurrentUser(): Promise<UnifiedAuthUser | null> {
    return auth.getCurrentUser();
  }

  // Update user profile
  static async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    return auth.updateUserProfile(updates);
  }

  // Helper to check if using AWS
  static isUsingAWS(): boolean {
    return this.useAWS;
  }

  // Confirm sign up (handled server-side)
  static async confirmSignUp(email: string, code: string): Promise<void> {
    throw new Error('Sign up confirmation is automatic via server-side registration');
  }

  // Resend confirmation code (handled server-side)
  static async resendConfirmationCode(email: string): Promise<void> {
    throw new Error('Confirmation codes are handled server-side');
  }
}
