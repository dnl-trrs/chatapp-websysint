import { storage, db, auth } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile as updateAuthProfile } from 'firebase/auth';

interface ProfileUpdateData {
  displayName?: string;
  username?: string;
  bio?: string;
  photoURL?: string;
}

/**
 * Upload a profile picture to Firebase Storage
 */
export const uploadProfilePicture = async (
  userId: string,
  file: File
): Promise<string> => {

  // Validate file
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Profile picture must be less than 5MB');
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('File must be an image (JPEG, PNG, GIF, or WebP)');
  }

  try {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `profilePictures/${userId}/avatar_${timestamp}.${fileExtension}`;
    const storageRef = ref(storage, fileName);

    // Upload with metadata
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString()
      }
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading profile picture:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      serverResponse: error.serverResponse
    });
    
    // Provide helpful error messages based on common issues
    if (error.code === 'storage/unauthorized') {
      throw new Error('You must be logged in to upload a profile picture');
    } else if (error.code === 'storage/unauthenticated') {
      throw new Error('Your session has expired. Please log in again');
    } else if (error.code === 'storage/object-not-found') {
      throw new Error('Upload failed. Please try again');
    } else if (error.code === 'storage/bucket-not-found' || error.code === 'storage/unknown') {
      throw new Error('Firebase Storage is not set up. Please contact support or see console for setup instructions');
    } else if (error.message?.includes('CORS')) {
      throw new Error('Storage configuration issue. Please contact support');
    } else if (error.message?.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your connection and try again');
    }
    
    throw new Error(`Failed to upload profile picture: ${error.message || error}`);
  }
};

/**
 * Update user profile in both Firestore and Firebase Auth
 */
export const updateUserProfileComplete = async (
  userId: string,
  updates: ProfileUpdateData,
  profilePictureFile?: File
): Promise<void> => {
  try {
    let photoURL = updates.photoURL;

    // Upload profile picture if provided
    if (profilePictureFile) {
      photoURL = await uploadProfilePicture(userId, profilePictureFile);
    }

    // Prepare Firestore update data
    const firestoreUpdateData: any = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    // Include photoURL if we have one
    if (photoURL !== undefined) {
      firestoreUpdateData.photoURL = photoURL || '';
    }

    // Update Firestore document
    await updateDoc(doc(db, 'users', userId), firestoreUpdateData);

    // Update Firebase Auth profile if current user
    if (auth.currentUser && auth.currentUser.uid === userId) {
      const authUpdateData: any = {};
      
      if (updates.displayName !== undefined) {
        authUpdateData.displayName = updates.displayName;
      }
      
      if (photoURL !== undefined) {
        authUpdateData.photoURL = photoURL || null;
      }

      if (Object.keys(authUpdateData).length > 0) {
        try {
          await updateAuthProfile(auth.currentUser, authUpdateData);
        } catch (authError) {
          console.error('Error updating Firebase Auth profile:', authError);
          // Don't throw - Firestore update was successful
        }
      }
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};
