// Use API endpoint for uploads and DynamoDB for profile data
import { userService } from './aws/dynamodb-client';

interface ProfileUpdateData {
  displayName?: string;
  username?: string;
  bio?: string;
  photoURL?: string;
}

/**
 * Upload a profile picture to AWS S3 via API endpoint
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
    // Upload via API endpoint
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('type', 'profile');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.url;
  } catch (error: any) {
    console.error('Error uploading profile picture:', error);
    throw new Error(`Failed to upload profile picture: ${error.message || error}`);
  }
};

/**
 * Update user profile in DynamoDB
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

    // Prepare DynamoDB update data
    const updateData: any = {
      ...updates,
      updatedAt: Date.now()
    };

    // Include photoURL if we have one
    if (photoURL !== undefined) {
      updateData.photoURL = photoURL || '';
    }

    // Update DynamoDB user document
    await userService.updateUser(userId, updateData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};
