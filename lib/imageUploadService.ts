import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Validate image file
 */
const validateImageFile = (file: File, maxSizeMB: number = 5): void => {
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`Image must be less than ${maxSizeMB}MB`);
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('File must be an image (JPEG, PNG, GIF, or WebP)');
  }
};

/**
 * Upload group chat picture
 */
export const uploadGroupChatPicture = async (
  groupId: string,
  file: File,
  uploaderId: string
): Promise<string> => {
  console.log('Starting group chat picture upload:', groupId);
  
  validateImageFile(file);

  try {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `groupChats/${groupId}/avatar_${timestamp}.${fileExtension}`;
    
    const storageRef = ref(storage, fileName);
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: uploaderId,
        uploadedAt: new Date().toISOString()
      }
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Update group chat document with new picture
    await updateDoc(doc(db, 'conversations', groupId), {
      photoURL: downloadURL,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: uploaderId
    });
    
    console.log('Group chat picture uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading group chat picture:', error);
    
    if (error.code === 'storage/unauthorized') {
      throw new Error('You must be logged in to upload a group picture');
    } else if (error.code === 'storage/unauthenticated') {
      throw new Error('Your session has expired. Please log in again');
    }
    
    throw new Error(`Failed to upload group picture: ${error.message || error}`);
  }
};

/**
 * Upload server icon/picture
 */
export const uploadServerPicture = async (
  serverId: string,
  file: File,
  uploaderId: string
): Promise<string> => {
  console.log('Starting server picture upload:', serverId);
  
  validateImageFile(file);

  try {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `servers/${serverId}/icon_${timestamp}.${fileExtension}`;
    
    const storageRef = ref(storage, fileName);
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: uploaderId,
        uploadedAt: new Date().toISOString()
      }
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Update server document with new icon
    await updateDoc(doc(db, 'servers', serverId), {
      icon: downloadURL,
      updatedAt: serverTimestamp()
    });
    
    console.log('Server icon uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading server icon:', error);
    
    if (error.code === 'storage/unauthorized') {
      throw new Error('You must be logged in to upload a server icon');
    } else if (error.code === 'storage/unauthenticated') {
      throw new Error('Your session has expired. Please log in again');
    }
    
    throw new Error(`Failed to upload server icon: ${error.message || error}`);
  }
};

/**
 * Upload channel icon/picture (for future use)
 */
export const uploadChannelPicture = async (
  channelId: string,
  file: File,
  uploaderId: string
): Promise<string> => {
  console.log('Starting channel picture upload:', channelId);
  
  validateImageFile(file);

  try {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `channels/${channelId}/icon_${timestamp}.${fileExtension}`;
    
    const storageRef = ref(storage, fileName);
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: uploaderId,
        uploadedAt: new Date().toISOString()
      }
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Update channel document with new icon
    await updateDoc(doc(db, 'channels', channelId), {
      icon: downloadURL,
      updatedAt: serverTimestamp()
    });
    
    console.log('Channel icon uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading channel icon:', error);
    
    if (error.code === 'storage/unauthorized') {
      throw new Error('You must be logged in to upload a channel icon');
    } else if (error.code === 'storage/unauthenticated') {
      throw new Error('Your session has expired. Please log in again');
    }
    
    throw new Error(`Failed to upload channel icon: ${error.message || error}`);
  }
};
