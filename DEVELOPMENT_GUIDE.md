# Chat App Development Guide

## Project Overview
A streamlined real-time messaging application built with Next.js 14, TypeScript, and Tailwind CSS, focusing on direct messaging, group chats, and social features.

## Current Development State

### ✅ Completed Features
- **Authentication**: Email/password auth with unique usernames and display names
- **Direct Messaging**: Real-time DM conversations between users
- **Group Chats**: Create and manage group conversations (up to 10 participants)
- **Friend System**: Send requests, search users, manage friendships
- **User Profiles**: Customizable profiles with bio and avatar support
- **Typing Indicators**: Real-time typing status in conversations
- **UI/UX**: Modern dark theme with glass morphism effects

### 🚧 In Progress
- AWS backend migration
- Enhanced message features (reactions, replies)
- Notification system improvements

### 📝 Planned Features
- AWS Lambda functions for backend logic
- DynamoDB for data storage
- S3 for file/image uploads
- CloudFront CDN for assets
- API Gateway for REST endpoints

## Quick Setup

### 1. Firebase Console Configuration

#### Enable Services
1. **Authentication**: Enable Email/Password
2. **Firestore**: Create database in production mode
3. **Storage**: Enable (for future use)

#### Deploy Security Rules
```bash
firebase deploy --only firestore:rules,storage:rules
```

#### Required Firestore Indexes
Create these composite indexes in Firebase Console:

1. **Conversations**: `participants` (Arrays) + `updatedAt` (Desc)
2. **Friend Requests**: `toUid` (Asc) + `status` (Asc)
3. **Users**: `username` (Asc) for user search functionality

### 2. Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Architecture Decisions

### Real-time Updates
- Using Firestore `onSnapshot` for servers, channels, and conversations
- Client-side sorting to avoid index requirements during development
- Will add `orderBy` clauses once indexes are created

### State Management
- React Context for authentication
- Local state for UI components
- Firestore as single source of truth

### Profile Pictures (Postponed)
- Base64 implementation ready with compression
- Stores directly in Firestore (no CORS issues)
- Max 512KB after compression
- Future: Move to Firebase Storage with CDN

## Known Issues

### Critical
1. **Message Updates**: New conversations don't appear for recipients without refresh
2. **Firestore Indexes**: Missing composite indexes cause console warnings

### Minor
1. **Friend System**: Accept/reject UI not implemented
2. **Typing Indicators**: Need "several people typing" aggregation
3. **Empty States**: Need better UI for no servers/channels

## Common Debugging Commands

```javascript
// Check auth status
firebase.auth().currentUser

// Test Firestore connection
firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).get()

// Monitor real-time updates
firebase.firestore().collection('conversations')
  .where('participants', 'array-contains', firebase.auth().currentUser.uid)
  .onSnapshot(snapshot => console.log('Conversations:', snapshot.docs.map(d => d.data())))
```

## Development Workflow

### Before Starting
1. Check for existing TODO items in code
2. Review console for any errors/warnings
3. Ensure dev server is running

### Making Changes
1. Test in multiple browser tabs (multi-user scenarios)
2. Check real-time updates work correctly
3. Verify Firebase rules allow operations
4. Monitor browser console for errors

### Common Fixes
- **Hydration Errors**: Add `suppressHydrationWarning` or use `useEffect` for client-only code
- **Permission Errors**: Check Firestore rules and user authentication
- **Missing Indexes**: Click console link to auto-create index

## File Structure Summary

```
/app              - Next.js pages and layouts
/components       - React components (modals, sidebars, etc.)
/lib             - Services (Firebase, channels, users, etc.)
/hooks           - Custom React hooks
/public          - Static assets
firestore.rules  - Security rules
storage.rules    - Storage rules (for future use)
```

## Next Session Priorities

1. **Fix message real-time updates** for new conversations
2. **Create Firestore indexes** to enable proper ordering
3. **Implement friend accept/reject UI** with notifications
4. **Add server management modal** for better UX
5. **Clean up empty states** with helpful prompts

## Testing Checklist

- [ ] Register new user with unique username
- [ ] Create server and channels
- [ ] Send messages in channels
- [ ] Start DM conversation
- [ ] Search and add friends
- [ ] Test typing indicators
- [ ] Edit/delete channels
- [ ] Delete server
- [ ] Test with multiple users

## Deployment Notes

- Environment variables needed in `.env.local`
- Firebase project: `chatapp-b58`
- Deploy rules before testing in production
- Ensure all indexes are created before launch
