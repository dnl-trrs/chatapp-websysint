// Unified Auth Service - AWS Cognito only (Firebase removed)
import { CognitoAuthService, CognitoAuthUser } from './cognito-auth';
import { isAWSConfigured } from './config';

// Unified user type
export interface UnifiedAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

// Convert Cognito user to unified format (already matches)
const cognitoToUnified = (user: CognitoAuthUser): UnifiedAuthUser => user;

export class UnifiedAuthService {
  private static useAWS = isAWSConfigured();

  // Sign up new user
  static async signUp(email: string, password: string, displayName: string): Promise<UnifiedAuthUser> {
    const user = await CognitoAuthService.signUp(email, password, displayName);
    return cognitoToUnified(user);
  }

  // Sign in existing user
  static async signIn(email: string, password: string): Promise<UnifiedAuthUser> {
    const user = await CognitoAuthService.signIn(email, password);
    return cognitoToUnified(user);
  }

  // Sign out current user
  static async signOut(): Promise<void> {
    await CognitoAuthService.signOut();
  }

  // Get current user
  static getCurrentUser(): UnifiedAuthUser | null {
    const user = CognitoAuthService.getCurrentUser();
    return user ? cognitoToUnified(user) : null;
  }

  // Update user profile
  static async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    await CognitoAuthService.updateProfile(updates);
  }

  // Send password reset email
  static async sendPasswordResetEmail(email: string): Promise<void> {
    await CognitoAuthService.sendPasswordResetEmail(email);
  }

  // Listen to auth state changes
  static onAuthStateChanged(callback: (user: UnifiedAuthUser | null) => void): () => void {
    return CognitoAuthService.onAuthStateChanged((user) => {
      callback(user ? cognitoToUnified(user) : null);
    });
  }

  // Confirm sign up (Cognito)
  static async confirmSignUp(email: string, code: string): Promise<void> {
    await CognitoAuthService.confirmSignUp(email, code);
  }

  // Resend confirmation code (Cognito)
  static async resendConfirmationCode(email: string): Promise<void> {
    await CognitoAuthService.resendConfirmationCode(email);
  }

  // Helper to check if using AWS
  static isUsingAWS(): boolean {
    return this.useAWS;
  }

  // Get the raw auth object (for compatibility)
  static getRawAuth() {
    return null; // AWS only, no raw auth object needed
  }
}

// Export a singleton instance that matches Firebase auth API
export const auth = {
  currentUser: UnifiedAuthService.getCurrentUser(),
  signOut: () => UnifiedAuthService.signOut(),
};
