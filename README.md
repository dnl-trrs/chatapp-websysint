# Chat Application

A real-time messaging application built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

### Core Functionality
- ✅ **Authentication**: Email/password with unique usernames
- ✅ **Direct Messaging**: Real-time DM conversations
- ✅ **Group Chats**: Create and manage group conversations
- ✅ **Friend System**: User search, friend requests, and management
- ✅ **User Profiles**: Customizable profiles with bio and avatar
- ✅ **Typing Indicators**: Real-time typing status

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd chatapp
npm install

# Configure environment (.env.local)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Deploy Firebase rules
firebase deploy --only firestore:rules,storage:rules

# Start development
npm run dev
```


## Firebase Setup

1. Create project in [Firebase Console](https://console.firebase.google.com)
2. Enable Authentication (Email/Password)
3. Create Firestore database (production mode)
4. Enable Storage (for future use)
5. Deploy security rules from `firestore.rules` and `storage.rules`
6. Create required indexes (see DEVELOPMENT_GUIDE.md)


## Development

See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) for:
- Architecture decisions
- Known issues and fixes
- Development workflow
- Testing checklist
- Next priorities



## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, Glass morphism theme
- **Backend**: Firebase (temporarily, migrating to AWS)
- **Real-time**: WebSocket connections
- **State**: React Context, Local state

## Next Steps

1. **AWS Migration** - Move backend services to AWS
2. **Performance Optimization** - Improve real-time message delivery
3. **Enhanced Profiles** - Add more customization options
4. **Message Features** - Add reactions, replies, and formatting

---

*For detailed development information, see [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)*
