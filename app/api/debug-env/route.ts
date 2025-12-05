import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const vars = {
    NODE_ENV: process.env.NODE_ENV,
    AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    AMPLIFY_ACCESS_KEY_ID_SET: !!process.env.AMPLIFY_ACCESS_KEY_ID,
    AMPLIFY_SECRET_ACCESS_KEY_SET: !!process.env.AMPLIFY_SECRET_ACCESS_KEY,
    AWS_ACCESS_KEY_ID_SET: !!process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY_SET: !!process.env.AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    NEXT_PUBLIC_S3_BUCKET: process.env.NEXT_PUBLIC_S3_BUCKET,
    DYNAMODB_TABLE: process.env.DYNAMODB_TABLE_NAME,
    COGNITO_POOL: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  };

  return NextResponse.json(vars);
}
