import { 
  CognitoUserPool, 
  CognitoUser, 
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession
} from 'amazon-cognito-identity-js';
import { userService } from './dynamodb-service';
import { awsConfig } from './config';

// Initialize Cognito User Pool
const userPool = awsConfig.cognito.userPoolId ? new CognitoUserPool({
  UserPoolId: awsConfig.cognito.userPoolId,
  ClientId: awsConfig.cognito.clientId,
}) : null;

// Type definitions
export interface CognitoAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

// Auth state management
let currentUser: CognitoAuthUser | null = null;
let authStateListeners: ((user: CognitoAuthUser | null) => void)[] = [];

// Helper to convert Cognito user to our user format
const formatUser = (cognitoUser: CognitoUser, attributes?: any): CognitoAuthUser => {
  const email = attributes?.email || cognitoUser.getUsername();
  return {
    uid: cognitoUser.getUsername(),
    email: email,
    displayName: attributes?.name || attributes?.preferred_username || email,
    photoURL: attributes?.picture || null,
    emailVerified: attributes?.email_verified === 'true',
  };
};

// Get user attributes
const getUserAttributes = (cognitoUser: CognitoUser): Promise<any> => {
  return new Promise((resolve, reject) => {
    cognitoUser.getUserAttributes((err, attributes) => {
      if (err) {
        reject(err);
      } else {
        const attrs: any = {};
        attributes?.forEach(attr => {
          attrs[attr.getName()] = attr.getValue();
        });
        resolve(attrs);
      }
    });
  });
};

export class CognitoAuthService {
  // Sign up new user
  static async signUp(email: string, password: string, displayName: string): Promise<CognitoAuthUser> {
    if (!userPool) throw new Error('Cognito not configured');

    return new Promise((resolve, reject) => {
      const attributeList: CognitoUserAttribute[] = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
        new CognitoUserAttribute({ Name: 'name', Value: displayName }),
      ];

      // Generate a unique username (not email format) since pool has email as alias
      // Users will still login with email, but Cognito needs a unique non-email username
      const username = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      userPool.signUp(
        username,  // Using generated username, users will login with email
        password,
        attributeList,
        [],
        async (err, result) => {
          if (err) {
            reject(err);
          } else if (result) {
            // Auto-confirm the user for development
            // In production, you'd send a confirmation email
            if (result.userConfirmed === false) {
              // Note: In a real app, you'd handle email confirmation
              // For now, the admin needs to confirm users manually
            }
            
            // Store the email as the uid since that's what users will use to login
            const user = formatUser(result.user, { email, name: displayName });
            user.uid = email; // Override to use email as the uid for consistency
            currentUser = user;
            authStateListeners.forEach(listener => listener(user));
            resolve(user);
          }
        }
      );
    });
  }

  // Sign in existing user
  static async signIn(email: string, password: string): Promise<CognitoAuthUser> {
    if (!userPool) throw new Error('Cognito not configured');

    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async (session) => {
          try {
            const attributes = await getUserAttributes(cognitoUser);
            const user = formatUser(cognitoUser, attributes);
            user.uid = email; // Use email as uid for consistency
            currentUser = user;
            authStateListeners.forEach(listener => listener(user));
            resolve(user);
          } catch (error) {
            reject(error);
          }
        },
        onFailure: (err) => {
          // Check if user needs confirmation
          if (err.code === 'UserNotConfirmedException') {
            // Auto-confirm the user since we have auto-verify enabled
            reject({ ...err, needsConfirmation: true });
          } else {
            reject(err);
          }
        },
        newPasswordRequired: (userAttributes) => {
          // Handle new password requirement if needed
          reject({ code: 'NewPasswordRequired', message: 'New password required' });
        }
      });
    });
  }

  // Sign out current user
  static async signOut(): Promise<void> {
    if (!userPool) throw new Error('Cognito not configured');

    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    currentUser = null;
    authStateListeners.forEach(listener => listener(null));
  }

  // Get current user
  static getCurrentUser(): CognitoAuthUser | null {
    if (!userPool) return null;
    
    if (currentUser) return currentUser;

    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) return null;

    // Try to get session
    return new Promise((resolve) => {
      cognitoUser.getSession(async (err: any, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
        } else {
          try {
            const attributes = await getUserAttributes(cognitoUser);
            const user = formatUser(cognitoUser, attributes);
            currentUser = user;
            resolve(user);
          } catch {
            resolve(null);
          }
        }
      });
    }) as any;
  }

  // Update user profile
  static async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    if (!userPool) throw new Error('Cognito not configured');

    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) throw new Error('No user logged in');

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err: any, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(err || new Error('No session'));
          return;
        }

        const attributes: CognitoUserAttribute[] = [];
        if (updates.displayName) {
          attributes.push(new CognitoUserAttribute({ Name: 'name', Value: updates.displayName }));
        }
        if (updates.photoURL) {
          attributes.push(new CognitoUserAttribute({ Name: 'picture', Value: updates.photoURL }));
        }

        cognitoUser.updateAttributes(attributes, (err, result) => {
          if (err) {
            reject(err);
          } else {
            // Update current user
            if (currentUser) {
              if (updates.displayName) currentUser.displayName = updates.displayName;
              if (updates.photoURL) currentUser.photoURL = updates.photoURL;
              authStateListeners.forEach(listener => listener(currentUser));
            }
            resolve();
          }
        });
      });
    });
  }

  // Reset password
  static async sendPasswordResetEmail(email: string): Promise<void> {
    if (!userPool) throw new Error('Cognito not configured');

    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.forgotPassword({
        onSuccess: () => {
          resolve();
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }

  // Listen to auth state changes
  static onAuthStateChanged(callback: (user: CognitoAuthUser | null) => void): () => void {
    authStateListeners.push(callback);
    
    // Check current session
    if (userPool) {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.getSession(async (err: any, session: CognitoUserSession | null) => {
          if (!err && session && session.isValid()) {
            try {
              const attributes = await getUserAttributes(cognitoUser);
              const user = formatUser(cognitoUser, attributes);
              currentUser = user;
              callback(user);
            } catch {
              callback(null);
            }
          } else {
            callback(null);
          }
        });
      } else {
        callback(null);
      }
    } else {
      callback(null);
    }

    // Return unsubscribe function
    return () => {
      authStateListeners = authStateListeners.filter(listener => listener !== callback);
    };
  }

  // Verify email with code
  static async confirmSignUp(email: string, code: string): Promise<void> {
    if (!userPool) throw new Error('Cognito not configured');

    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Resend confirmation code
  static async resendConfirmationCode(email: string): Promise<void> {
    if (!userPool) throw new Error('Cognito not configured');

    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}