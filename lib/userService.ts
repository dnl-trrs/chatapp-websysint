import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { updateProfile, User } from "firebase/auth";
import { db, storage, auth } from "./firebase";

export interface UserProfile {
  uid: string;
  displayName: string;  // This will be the nickname (display name shown to others)
  username?: string;     // Unique username for identification
  email: string;
  photoURL?: string;
  bio?: string;
  joinDate: Timestamp | Date;
  lastActive?: Timestamp;
  status?: "online" | "idle" | "dnd" | "offline";
}

/**
 * Create or update a user profile in Firestore
 */
export const createUserProfile = async (user: User) => {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Only create a new profile if it doesn't exist
      // This should only happen for users created outside of the registration flow
      // (e.g., through social login or other auth methods)
      
      // Generate a unique username from email or display name
      const baseUsername = (user.email?.split('@')[0] || user.displayName || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      let username = baseUsername;
      let counter = 1;
      
      // Check if username is taken and add numbers until we find a unique one
      while (!(await isUsernameAvailable(username))) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
      
      const userData: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || "Anonymous",  // Nickname
        email: user.email || "",
        photoURL: user.photoURL || "",
        bio: "",
        username: username,  // Unique username
        joinDate: serverTimestamp() as Timestamp,
        lastActive: serverTimestamp() as Timestamp,
        status: "online",
      };

      await setDoc(userRef, userData);
      // Return with current date for immediate use
      return { ...userData, joinDate: new Date() };
    } else {
      // Update last active and status only, don't overwrite existing data
      await updateDoc(userRef, {
        lastActive: serverTimestamp(),
        status: "online",
        // Update Firebase Auth data only if missing in Firestore
        ...(user.photoURL && !userSnap.data().photoURL ? { photoURL: user.photoURL } : {}),
      });
      const existingData = userSnap.data() as UserProfile;
      // Ensure joinDate is set if it was missing
      if (!existingData.joinDate) {
        await updateDoc(userRef, {
          joinDate: serverTimestamp()
        });
      }
      return existingData;
    }
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    throw error;
  }
};

/**
 * Get a user profile by UID
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
};

/**
 * Update user profile information
 */
export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile>
) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      ...updates,
      lastActive: serverTimestamp(),
    });

    // Also update Firebase Auth profile if display name or photoURL changed
    if (auth.currentUser && auth.currentUser.uid === uid) {
      const authUpdates: any = {};
      if (updates.displayName) {
        authUpdates.displayName = updates.displayName;
      }
      if (updates.photoURL) {
        authUpdates.photoURL = updates.photoURL;
      }
      if (Object.keys(authUpdates).length > 0) {
        await updateProfile(auth.currentUser, authUpdates);
      }
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

/**
 * Upload profile picture to Firebase Storage
 */
export const uploadProfilePicture = async (
  uid: string,
  file: File
): Promise<string> => {
  try {
    // Check if user is authenticated
    if (!auth.currentUser) {
      throw new Error('User must be authenticated to upload images');
    }
    
    // Check if the authenticated user matches the uid
    if (auth.currentUser.uid !== uid) {
      throw new Error('You can only upload images to your own profile');
    }
    
    console.log('Starting upload for user:', uid);
    console.log('Auth user:', auth.currentUser.uid);
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 5MB');
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('File must be an image (JPEG, PNG, GIF, or WebP)');
    }
    
    // Create a reference to the file location with timestamp to avoid caching issues
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop() || 'jpg';
    const fileName = `profile_pictures/${uid}/avatar_${timestamp}.${fileExtension}`;
    console.log('Upload path:', fileName);
    
    const storageRef = ref(storage, fileName);

    // Upload the file with metadata - include a token for public access
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: uid,
        uploadedAt: new Date().toISOString(),
        // Add a token to bypass CORS
        firebaseStorageDownloadTokens: Math.random().toString(36).substring(2)
      },
      cacheControl: 'public, max-age=31536000'
    };
    
    console.log('Uploading to Firebase Storage...');
    
    try {
      const snapshot = await uploadBytes(storageRef, file, metadata);
      console.log('Upload complete:', snapshot);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL obtained:', downloadURL);
      
      // Ensure the URL is properly formatted
      if (!downloadURL.includes('firebasestorage.googleapis.com')) {
        throw new Error('Invalid download URL received');
      }

    // Update user profile with new photo URL
    await updateUserProfile(uid, { photoURL: downloadURL });

    // Update Firebase Auth profile
    if (auth.currentUser && auth.currentUser.uid === uid) {
      await updateProfile(auth.currentUser, {
        photoURL: downloadURL,
      });
    }

      return downloadURL;
    } catch (uploadError: any) {
      console.error('Upload error details:', uploadError);
      throw uploadError;
    }
  } catch (error: any) {
    console.error("Error uploading profile picture:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    
    // Provide more specific error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error('You do not have permission to upload images. Please make sure you are logged in.');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload was cancelled');
    } else if (error.code === 'storage/unknown') {
      throw new Error('An unknown error occurred. Please try again.');
    }
    
    throw error;
  }
};

/**
 * Check if username is available
 */
export const isUsernameAvailable = async (
  username: string,
  excludeUid?: string
): Promise<boolean> => {
  try {
    // Validate username format
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username.toLowerCase())) {
      return false;
    }
    
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return true;
    }

    // If we're excluding a UID (for updates), check if the username belongs to that user
    if (excludeUid && querySnapshot.docs[0].id === excludeUid) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking username availability:", error);
    throw error;
  }
};

/**
 * Update user status (online, offline, etc.)
 */
export const updateUserStatus = async (
  uid: string,
  status: "online" | "idle" | "dnd" | "offline"
) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      status,
      lastActive: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    throw error;
  }
};

/**
 * Search users by display name or username
 */
export const searchUsers = async (searchTerm: string): Promise<UserProfile[]> => {
  try {
    const usersRef = collection(db, "users");
    const searchLower = searchTerm.toLowerCase();
    
    // Search by username
    const usernameQuery = query(
      usersRef,
      where("username", ">=", searchLower),
      where("username", "<=", searchLower + "\uf8ff")
    );
    
    const usernameSnapshot = await getDocs(usernameQuery);
    const users = usernameSnapshot.docs.map(doc => doc.data() as UserProfile);
    
    return users;
  } catch (error) {
    console.error("Error searching users:", error);
    throw error;
  }
};
