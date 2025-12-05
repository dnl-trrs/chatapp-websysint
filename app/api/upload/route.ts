import { NextRequest, NextResponse } from 'next/server';
import { getAWSCredentials, getAWSRegion } from '@/lib/aws/server-config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: getAWSRegion(),
  credentials: {
    accessKeyId: getAWSCredentials().accessKeyId,
    secretAccessKey: getAWSCredentials().secretAccessKey
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'chatapp-uploads';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const type = formData.get('type') as string || 'profile';

    if (!file || !userId) {
      return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 });
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `${type}/${userId}/${Date.now()}.${fileExtension}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3 (bucket policy handles public access)
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: file.type
    });

    await s3Client.send(command);

    // Return the public URL
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${fileName}`;
    
    return NextResponse.json({ 
      url: publicUrl,
      key: fileName 
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// Get presigned URL for direct browser upload (optional alternative method)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get('fileName');
    const fileType = searchParams.get('fileType');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'profile';

    if (!fileName || !fileType || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const fileExtension = fileName.split('.').pop();
    const key = `${type}/${userId}/${Date.now()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${key}`;

    return NextResponse.json({
      signedUrl,
      publicUrl,
      key
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}

// Delete file from S3
export async function DELETE(request: NextRequest) {
  try {
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}