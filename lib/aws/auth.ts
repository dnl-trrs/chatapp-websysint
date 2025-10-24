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
  photoURL: string | null;
  emailVerified: boolean;
}

// Register user - simplified with immediate sign-in
export const registerUser = async (
  email: string,
  password: string,
  displayName: string,
  username: string
): Promise<AuthUser> => {
  return new Promise((resolve, reject) => {
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: displayName }),
      new CognitoUserAttribute({ Name: 'preferred_username', Value: username })
    ];

    // Generate unique username (not email) since pool uses email alias
    const uniqueUsername = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    userPool.signUp(uniqueUsername, password, attributeList, [], async (err, result) => {
      if (err) {
        console.error('Registration error:', err);
        reject(err);
        return;
      }

      if (result) {
        const userId = result.userSub;
        
        // Create user in DynamoDB immediately
        try {
          await userService.createUser(userId, {
            email,
            displayName,
            username: username.toLowerCase(),
            photoURL: '',
            bio: '',
            status: 'online',
            emailVerified: false,
            createdAt: Date.now()
          });
        } catch (dbError) {
          console.error('Error creating user in DynamoDB:', dbError);
        }

        // Return user object
        const authUser: AuthUser = {
          uid: userId,
          email,
          displayName,
          photoURL: null,
          emailVerified: false
        };

        resolve(authUser);
      }
    });
  });
};

// Sign in user
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
            userData = await userService.createUser(userId, {
              email: payload['email'],
              displayName: payload['name'] || email.split('@')[0],
              username: payload['preferred_username'] || email.split('@')[0],
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
          userData = {
            displayName: payload['name'] || email.split('@')[0],
            photoURL: payload['picture'] || ''
          };
        }

        const authUser: AuthUser = {
          uid: userId,
          email: payload['email'],
          displayName: userData.displayName || payload['name'],
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
  const currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.signOut();
  }
};

// Get current user
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  return new Promise((resolve) => {
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

  // Poll for changes every 5 seconds
  const interval = setInterval(async () => {
    const user = await getCurrentUser();
    callback(user);
  }, 5000);

  return () => clearInterval(interval);
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