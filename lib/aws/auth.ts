import { DirectCognitoAuth } from './cognito-direct-auth';
import { userService } from './dynamodb-client';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

// Registration is handled server-side via /api/auth/register
// No client-side registration function is exported from here.

// Sign in user with email and password
export const signInUser = async (
  email: string,
  password: string
): Promise<AuthUser> => {
  // Use direct Cognito API to avoid SECRET_HASH behavior in the identity-js SDK
  const { idToken, accessToken } = await DirectCognitoAuth.signIn(email, password);
  const payload = JSON.parse(atob(idToken.split('.')[1]));

  // Get or create user in DynamoDB
  const userId = payload['sub'];
  let userData: any;

  try {
    userData = await userService.getUser(userId);
    if (!userData) {
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
    photoURL: userData.photoURL || null,
    emailVerified: payload['email_verified'] || false
  };

  // Persist tokens for getCurrentUser fallback
  if (typeof window !== 'undefined') {
    localStorage.setItem('idToken', idToken);
    localStorage.setItem('accessToken', accessToken);
  }

  return authUser;
};

// Sign out user
export const signOutUser = async (): Promise<void> => {
  // Clear tokens from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
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

            resolve({
              uid: userId,
              email: payload['email'],
              displayName: userData?.displayName || payload['name'] || null,
              photoURL: userData?.photoURL || null,
              emailVerified: payload['email_verified'] || false
            });
            return;
          }
        } catch (err) {
          console.error('Error parsing idToken:', err);
          localStorage.removeItem('idToken');
        }
      }
    }

    // Fall back removed for identity-js; rely on stored tokens only
    resolve(null);
  });
};

// Update user profile
export const updateUserProfile = async (updates: {
  displayName?: string;
  photoURL?: string;
  bio?: string;
}): Promise<void> => {
  const idToken = typeof window !== 'undefined' ? localStorage.getItem('idToken') : null;
  if (!idToken) {
    throw new Error('No authenticated user');
  }

  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const userId = payload['sub'];
    
    // Update in DynamoDB
    await userService.updateUser(userId, updates);
  } catch (error) {
    throw error;
  }
};

// Subscribe to auth state changes
export const onAuthStateChanged = (callback: (user: AuthUser | null) => void): (() => void) => {
  // Check initial state
  getCurrentUser().then(callback);

  // Poll for auth state changes so UI reacts to logout immediately
  const interval = setInterval(() => {
    getCurrentUser().then(callback);
  }, 1000);

  return () => clearInterval(interval);
};

// Confirm user registration (for users who need to enter confirmation code)
export const confirmRegistration = async (email: string, code: string): Promise<void> => {
  // Registration confirmation is handled server-side via /api/auth/register
  // This endpoint is kept for backward compatibility but not used with direct API
  throw new Error('Use server-side registration endpoint');
};

// Resend confirmation code
export const resendConfirmationCode = async (email: string): Promise<void> => {
  // Confirmation code resending is handled server-side
  throw new Error('Use server-side registration endpoint');
};
