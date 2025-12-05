// Use AWS S3 for image uploads
import { s3Service } from './aws/s3-service';

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
 * Upload group chat picture to AWS S3
 */
export const uploadGroupChatPicture = async (
  groupId: string,
  file: File,
  uploaderId: string
): Promise<string> => {
  console.log('Starting group chat picture upload:', groupId);
  
  validateImageFile(file);

  try {
    const url = await s3Service.uploadFile(file, `group-chats/${groupId}`);
    console.log('Group chat picture uploaded successfully:', url);
    return url;
  } catch (error: any) {
    console.error('Error uploading group chat picture:', error);
    throw new Error(`Failed to upload group picture: ${error.message || error}`);
  }
};

/**
 * Upload server icon/picture (not currently used in core features)
 */
export const uploadServerPicture = async (
  serverId: string,
  file: File,
  uploaderId: string
): Promise<string> => {
  console.log('Starting server picture upload:', serverId);
  
  validateImageFile(file);

  try {
    const url = await s3Service.uploadFile(file, `servers/${serverId}`);
    console.log('Server icon uploaded successfully:', url);
    return url;
  } catch (error: any) {
    console.error('Error uploading server icon:', error);
    throw new Error(`Failed to upload server icon: ${error.message || error}`);
  }
};

/**
 * Upload channel icon/picture (not currently used in core features)
 */
export const uploadChannelPicture = async (
  channelId: string,
  file: File,
  uploaderId: string
): Promise<string> => {
  console.log('Starting channel picture upload:', channelId);
  
  validateImageFile(file);

  try {
    const url = await s3Service.uploadFile(file, `channels/${channelId}`);
    console.log('Channel icon uploaded successfully:', url);
    return url;
  } catch (error: any) {
    console.error('Error uploading channel icon:', error);
    throw new Error(`Failed to upload channel icon: ${error.message || error}`);
  }
};
