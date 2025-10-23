// Unified Auth Service - Automatically uses AWS Cognito or Firebase
import { auth as firebaseAuth } from '../firebase';
import { 
  signInWithEmailAndPassword as firebaseSignIn,
  createUserWithEmailAndPassword as firebaseCreateUser,
  updateProfile as firebaseUpdateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordReset,
  User as FirebaseUser
} from 'firebase/auth';
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

// Convert Firebase user to unified format
const firebaseToUnified = (user: FirebaseUser): UnifiedAuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  emailVerified: user.emailVerified,
});

// Convert Cognito user to unified format (already matches)
const cognitoToUnified = (user: CognitoAuthUser): UnifiedAuthUser => user;

export class UnifiedAuthService {
  private static useAWS = isAWSConfigured();

  // Sign up new user
  static async signUp(email: string, password: string, username: string): Promise<UnifiedAuthUser> {
    if (this.useAWS) {
      const user = await CognitoAuthService.signUp(email, password, username);
      return cognitoToUnified(user);
    } else {
      // Firebase fallback
      const credential = await firebaseCreateUser(firebaseAuth, email, password);
      await firebaseUpdateProfile(credential.user, { displayName: username });
      return firebaseToUnified(credential.user);
    }
  }

  // Sign in existing user
  static async signIn(email: string, password: string): Promise<UnifiedAuthUser> {
    if (this.useAWS) {
      const user = await CognitoAuthService.signIn(email, password);
      return cognitoToUnified(user);
    } else {
      // Firebase fallback
      const credential = await firebaseSignIn(firebaseAuth, email, password);
      return firebaseToUnified(credential.user);
    }
  }

  // Sign out current user
  static async signOut(): Promise<void> {
    if (this.useAWS) {
      await CognitoAuthService.signOut();
    } else {
      await firebaseSignOut(firebaseAuth);
    }
  }

  // Get current user
  static getCurrentUser(): UnifiedAuthUser | null {
    if (this.useAWS) {
      const user = CognitoAuthService.getCurrentUser();
      return user ? cognitoToUnified(user) : null;
    } else {
      const user = firebaseAuth.currentUser;
      return user ? firebaseToUnified(user) : null;
    }
  }

  // Update user profile
  static async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    if (this.useAWS) {
      await CognitoAuthService.updateProfile(updates);
    } else {
      const user = firebaseAuth.currentUser;
      if (user) {
        await firebaseUpdateProfile(user, updates);
      }
    }
  }

  // Send password reset email
  static async sendPasswordResetEmail(email: string): Promise<void> {
    if (this.useAWS) {
      await CognitoAuthService.sendPasswordResetEmail(email);
    } else {
      await firebaseSendPasswordReset(firebaseAuth, email);
    }
  }

  // Listen to auth state changes
  static onAuthStateChanged(callback: (user: UnifiedAuthUser | null) => void): () => void {
    if (this.useAWS) {
      return CognitoAuthService.onAuthStateChanged((user) => {
        callback(user ? cognitoToUnified(user) : null);
      });
    } else {
      // Firebase fallback
      const unsubscribe = firebaseOnAuthStateChanged(firebaseAuth, (user) => {
        callback(user ? firebaseToUnified(user) : null);
      });
      return unsubscribe;
    }
  }

  // Confirm sign up (Cognito only, no-op for Firebase)
  static async confirmSignUp(email: string, code: string): Promise<void> {
    if (this.useAWS) {
      await CognitoAuthService.confirmSignUp(email, code);
    }
    // No-op for Firebase
  }

  // Resend confirmation code (Cognito only, no-op for Firebase)
  static async resendConfirmationCode(email: string): Promise<void> {
    if (this.useAWS) {
      await CognitoAuthService.resendConfirmationCode(email);
    }
    // No-op for Firebase
  }

  // Helper to check if using AWS
  static isUsingAWS(): boolean {
    return this.useAWS;
  }

  // Get the raw auth object (for compatibility)
  static getRawAuth() {
    return this.useAWS ? null : firebaseAuth;
  }
}

// Export a singleton instance that matches Firebase auth API
export const auth = {
  currentUser: UnifiedAuthService.getCurrentUser(),
  signOut: () => UnifiedAuthService.signOut(),
};