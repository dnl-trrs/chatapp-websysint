import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
// Relies on IAM Role in production (Amplify) or custom env vars if role is restricted
const clientConfig: any = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2',
  maxAttempts: 3
};

// Check for custom credentials (workaround for Amplify UI restriction on AWS_ prefix)
const accessKeyId = process.env.AMPLIFY_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AMPLIFY_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

if (accessKeyId && secretAccessKey) {
  clientConfig.credentials = {
    accessKeyId,
    secretAccessKey
  };
}

const s3Client = new S3Client(clientConfig);

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'chatapp-uploads';
const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-2';

export async function POST(request: NextRequest) {
  try {
    // Validate bucket and credentials
    if (!BUCKET_NAME) {
      console.error('S3_BUCKET_NAME not configured');
      return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const type = formData.get('type') as string || 'profile';

    if (!file || !userId) {
      return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 });
    }
    
    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
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
    const publicUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileName}`;
    console.log('File uploaded successfully:', { fileName, url: publicUrl });
    
    return NextResponse.json({ 
      url: publicUrl,
      key: fileName 
    });
  } catch (error) {
    const err = error as any;
    console.error('Error uploading file:', err?.code || err?.message || error);
    return NextResponse.json({ error: 'Failed to upload file', code: err?.code }, { status: 500 });
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
    const publicUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    return NextResponse.json({
      signedUrl,
      publicUrl,
      key
    });
  } catch (error) {
    const err = error as any;
    console.error('Error generating presigned URL:', err?.code || err?.message || error);
    return NextResponse.json({ error: 'Failed to generate upload URL', code: err?.code }, { status: 500 });
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
    const err = error as any;
    console.error('Error deleting file:', err?.code || err?.message || error);
    return NextResponse.json({ error: 'Failed to delete file', code: err?.code }, { status: 500 });
  }
}