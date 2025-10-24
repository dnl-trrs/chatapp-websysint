import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const BUCKET_NAME = process.env.NEXT_PUBLIC_S3_BUCKET || 'chatapp-uploads-082187380736';

export const s3Service = {
  // Upload file to S3
  async uploadFile(file: File, path: string): Promise<string> {
    const key = `${path}/${Date.now()}_${file.name}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: file.type,
      // Make file publicly readable
      ACL: 'public-read'
    });

    try {
      await s3Client.send(command);
      // Return public URL
      return `https://${BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  // Upload base64 image
  async uploadBase64(base64Data: string, filename: string, path: string): Promise<string> {
    // Remove data URL prefix if present
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    
    const key = `${path}/${Date.now()}_${filename}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg', // Adjust based on actual image type
      ACL: 'public-read'
    });

    try {
      await s3Client.send(command);
      return `https://${BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`;
    } catch (error) {
      console.error('Error uploading base64:', error);
      throw error;
    }
  },

  // Delete file from S3
  async deleteFile(fileUrl: string): Promise<void> {
    // Extract key from URL
    const urlParts = fileUrl.split('.amazonaws.com/');
    if (urlParts.length < 2) {
      throw new Error('Invalid S3 URL');
    }
    const key = urlParts[1];

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    try {
      await s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  // Get presigned URL for upload (for direct browser uploads)
  async getUploadUrl(filename: string, path: string, contentType: string): Promise<string> {
    const key = `${path}/${Date.now()}_${filename}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType
    });

    try {
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
      return uploadUrl;
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw error;
    }
  },

  // Get presigned URL for download (for private files)
  async getDownloadUrl(fileUrl: string): Promise<string> {
    // Extract key from URL
    const urlParts = fileUrl.split('.amazonaws.com/');
    if (urlParts.length < 2) {
      return fileUrl; // Return original URL if not S3
    }
    const key = urlParts[1];

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    try {
      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
      return downloadUrl;
    } catch (error) {
      console.error('Error generating download URL:', error);
      return fileUrl; // Return original URL on error
    }
  }
};

// Profile picture upload helper
export const uploadProfilePicture = async (file: File, userId: string): Promise<string> => {
  return s3Service.uploadFile(file, `profile-pictures/${userId}`);
};

// Message attachment upload helper
export const uploadMessageAttachment = async (file: File, conversationId: string): Promise<string> => {
  return s3Service.uploadFile(file, `messages/${conversationId}/attachments`);
};

export default s3Service;