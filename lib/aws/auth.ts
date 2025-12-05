import { 
  CognitoUserPool, 
  CognitoUser, 
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession
} from 'amazon-cognito-identity-js';
import { userService } from './dynamodb-client';

// Cognito configuration
const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || ''
};

const userPool = new CognitoUserPool(poolData);

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

// Registration is handled server-side via /api/auth/register
// No client-side registration function is exported from here.

// Sign in user with email and password (client-side, no SECRET_HASH needed)
export const signInUser = async (
  email: string,
  password: string
): Promise<AuthUser> => {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool
    });

    // Use client-side authentication (works without CLIENT_SECRET)

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: async (session) => {
        const idToken = session.getIdToken();
        const payload = idToken.decodePayload();
        
        // Get or create user in DynamoDB
        const userId = payload['sub'];
        let userData;
        
        try {
          userData = await userService.getUser(userId);
          if (!userData) {
            // Create user if doesn't exist
            const userEmail = payload['email'];
            userData = await userService.createUser(userId, {
              email: userEmail,
              displayName: payload['name'] || userEmail.split('@')[0],
              username: userEmail.split('@')[0],
              photoURL: payload['picture'] || '',
              emailVerified: payload['email_verified'] || false,
              status: 'online'
            });
          } else {
            // Update last login
            await userService.updateUser(userId, {
              lastLogin: Date.now(),
              status: 'online'
            });
          }
        } catch (dbError) {
          console.error('DynamoDB error:', dbError);
          const userEmail = payload['email'];
          userData = {
            displayName: payload['name'] || userEmail.split('@')[0],
            photoURL: payload['picture'] || ''
          };
        }

        const authUser: AuthUser = {
          uid: userId,
          email: payload['email'],
          displayName: userData.displayName || payload['name'],
          username: userData.username || null,
          photoURL: userData.photoURL || null,
          emailVerified: payload['email_verified'] || false
        };

        resolve(authUser);
      },
      onFailure: (err) => {
        console.error('Sign in error:', err);
        
        // If user is not confirmed, try to auto-confirm for development
        if (err.code === 'UserNotConfirmedException') {
          // In production, you would send a confirmation code
          // For development, user needs to be confirmed manually in AWS Console
          reject(new Error('Please confirm your email address. Check your inbox for the confirmation code.'));
        } else {
          reject(err);
        }
      }
    });
  });
};

// Sign out user
export const signOutUser = async (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      // Clear tokens from localStorage (from server-side auth)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('idToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }

      const currentUser = userPool.getCurrentUser();
      if (currentUser) {
        // Sign out globally to clear all sessions
        currentUser.globalSignOut({
          onSuccess: () => {
            console.log('Global sign out successful');
            resolve();
          },
          onFailure: (err: any) => {
            console.error('Error during global sign out:', err);
            // Fallback to local sign out
            currentUser.signOut();
            resolve();
          }
        });
      } else {
        resolve();
      }
    } catch (error) {
      console.error('Error signing out:', error);
      resolve();
    }
  });
};

// Get current user
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  return new Promise(async (resolve) => {
    // First, check if we have tokens in localStorage (from server-side auth)
    if (typeof window !== 'undefined') {
      const idToken = localStorage.getItem('idToken');
      if (idToken) {
        try {
          // Parse the JWT manually
          const parts = idToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const userId = payload['sub'];
            
            // Get user data from DynamoDB
            let userData;
            try {
              userData = await userService.getUser(userId);
            } catch (error) {
              console.error('Error fetching user from DynamoDB:', error);
              userData = null;
            }

            const resolvedUser = {
              uid: userId,
              email: payload['email'],
              displayName: userData?.displayName || payload['name'] || null,
              username: userData?.username || null,
              photoURL: userData?.photoURL || null,
              emailVerified: payload['email_verified'] || false
            };
            console.log('getCurrentUser resolved:', { userId, userData, resolvedUser });
            resolve(resolvedUser);
            return;
          }
        } catch (err) {
          console.error('Error parsing idToken:', err);
          localStorage.removeItem('idToken');
        }
      }
    }

    // Fall back to Cognito session (for backward compatibility)
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve(null);
      return;
    }

    currentUser.getSession(async (err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }

      const idToken = session.getIdToken();
      const payload = idToken.decodePayload();
      const userId = payload['sub'];
      
      // Get user data from DynamoDB
      let userData;
      try {
        userData = await userService.getUser(userId);
      } catch (error) {
        console.error('Error fetching user from DynamoDB:', error);
        userData = null;
      }

      resolve({
        uid: userId,
        email: payload['email'],
        displayName: userData?.displayName || payload['name'] || null,
        username: userData?.username || null,
        photoURL: userData?.photoURL || null,
        emailVerified: payload['email_verified'] || false
      });
    });
  });
};

// Update user profile
export const updateUserProfile = async (updates: {
  displayName?: string;
  photoURL?: string;
  bio?: string;
}): Promise<void> => {
  const currentUser = userPool.getCurrentUser();
  if (!currentUser) {
    throw new Error('No authenticated user');
  }

  return new Promise((resolve, reject) => {
    currentUser.getSession(async (err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        reject(err || new Error('No session'));
        return;
      }

      const idToken = session.getIdToken();
      const userId = idToken.decodePayload()['sub'];
      
      // Update in DynamoDB
      try {
        await userService.updateUser(userId, updates);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};

// Subscribe to auth state changes
export const onAuthStateChanged = (callback: (user: AuthUser | null) => void): (() => void) => {
  // Check initial state
  getCurrentUser().then(callback);

  // Poll for auth state changes with longer interval (3s) and jitter to reduce DB load
  const baseInterval = 3000;
  const jitter = Math.random() * 500; // 0-500ms jitter
  const interval = setInterval(() => {
    getCurrentUser().then(callback);
  }, baseInterval + jitter);

  return () => clearInterval(interval);
};

// Wait for user to be ready (with timeout)
export const waitForUserReady = async (maxWaitMs: number = 2000): Promise<AuthUser | null> => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const user = await getCurrentUser();
    if (user) {
      return user;
    }
    // Wait 200ms before retrying
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return null;
};

// Confirm user registration (for users who need to enter confirmation code)
export const confirmRegistration = async (email: string, code: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool
    });

    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Resend confirmation code
export const resendConfirmationCode = async (email: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool
    });

    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};