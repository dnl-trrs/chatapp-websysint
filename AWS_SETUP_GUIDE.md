# AWS Setup Guide for Chat Application

## Current Status
The application is now configured to automatically use AWS services when configured, or fall back to Firebase if AWS credentials are not provided.

## Quick Setup Instructions

### Step 1: Set up AWS Cognito (Authentication)

1. Log into AWS Console
2. Navigate to **Cognito** service
3. Click **Create user pool**
4. Configure the following:
   - **Authentication providers**: Email
   - **Password policy**: Set your requirements
   - **Multi-factor authentication**: Optional (recommended)
   - **User account recovery**: Email
   - **Required attributes**: email, name, preferred_username
   - **Custom attributes**: Add 'picture' (string), 'bio' (string)

5. After creation, note down:
   - User Pool ID (e.g., us-east-1_xxxxxxxxx)
   - App Client ID (from App Integration tab)

### Step 2: Configure Environment Variables

1. Copy `.env.aws.example` to `.env.local`:
```bash
cp .env.aws.example .env.local
```

2. Add your AWS Cognito credentials:
```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your_pool_id_here
NEXT_PUBLIC_COGNITO_CLIENT_ID=your_client_id_here
```

### Step 3: Test Authentication

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Navigate to http://localhost:3000/register
4. Try creating a new account - it will use AWS Cognito if configured, or Firebase if not

## How It Works

### Automatic Service Selection
The app automatically detects if AWS is configured:
- **If AWS credentials are present**: Uses AWS Cognito for auth
- **If AWS credentials are missing**: Falls back to Firebase

### Unified Auth Service
Located in `lib/aws/unified-auth.ts`, this service:
- Provides a single API for authentication
- Automatically switches between AWS and Firebase
- Maintains consistent user data structure

### Updated Components
The following have been updated to use the unified auth:
- ✅ `hooks/useAuth.tsx` - Authentication context
- ✅ `app/login/page.tsx` - Login page
- ✅ `app/register/page.tsx` - Registration page
- ✅ `components/SettingsPanel.tsx` - User settings

## Next Steps for Full AWS Migration

### Required AWS Services (Not Yet Implemented)
1. **DynamoDB** - For database (replacing Firestore)
2. **S3** - For file storage (replacing Firebase Storage)
3. **API Gateway + Lambda** - For backend APIs
4. **WebSocket API** - For real-time messaging

### Current Firebase Dependencies
These services still use Firebase and need AWS replacements:
- `conversationService.ts` - Uses Firestore
- `friendService.ts` - Uses Firestore
- `profileService.ts` - Uses Firebase Storage & Firestore
- `userService.ts` - Uses Firestore
- `typingService.ts` - Uses Firestore

## Testing Checklist

### With AWS Configured:
- [ ] User can register with Cognito
- [ ] User receives confirmation email
- [ ] User can log in
- [ ] User profile updates work
- [ ] Password reset works

### Without AWS (Firebase Fallback):
- [ ] Registration still works
- [ ] Login still works
- [ ] All features function normally

## Troubleshooting

### Common Issues:

1. **"Cognito not configured" error**
   - Check that both User Pool ID and Client ID are set in `.env.local`
   - Restart the development server after changing environment variables

2. **Registration fails with Cognito**
   - Ensure your Cognito app client allows user sign-up
   - Check that password meets your configured policy
   - Verify email format is valid

3. **App still uses Firebase**
   - The app will use Firebase if AWS credentials are not found
   - Check `.env.local` has the correct variable names
   - Clear browser cache and restart dev server

## Benefits of This Approach

1. **Zero Downtime Migration**: App works with either service
2. **Gradual Migration**: Can migrate services one at a time
3. **Easy Testing**: Can test AWS services without breaking Firebase
4. **Rollback Safety**: Can instantly revert by removing AWS credentials

## Support

For issues or questions:
1. Check the console for error messages
2. Verify AWS credentials in `.env.local`
3. Ensure AWS services are properly configured in AWS Console
4. Review the unified auth service in `lib/aws/unified-auth.ts`