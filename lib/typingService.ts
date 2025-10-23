import { db } from './firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';

interface TypingUser {
  uid: string;
  displayName: string;
  timestamp: any;
}

/**
 * Set typing status for a user in a channel
 */
export const setTypingStatus = async (
  channelId: string,
  userId: string,
  displayName: string,
  isTyping: boolean
) => {
  const typingRef = doc(db, 'channels', channelId, 'typing', userId);
  
  if (isTyping) {
    await setDoc(typingRef, {
      uid: userId,
      displayName,
      timestamp: serverTimestamp()
    });
  } else {
    await deleteDoc(typingRef).catch(() => {
      // Ignore errors when deleting non-existent documents
    });
  }
};

/**
 * Subscribe to typing status changes in a channel
 */
export const subscribeToTypingStatus = (
  channelId: string,
  currentUserId: string,
  callback: (typingUsers: TypingUser[]) => void
) => {
  const typingRef = collection(db, 'channels', channelId, 'typing');
  
  const unsubscribe = onSnapshot(typingRef, (snapshot) => {
    const typingUsers: TypingUser[] = [];
    const now = Date.now();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Filter out current user and stale typing indicators (older than 5 seconds)
      if (data.uid !== currentUserId) {
        const timestamp = data.timestamp?.toMillis() || 0;
        if (now - timestamp < 5000) {
          typingUsers.push({
            uid: data.uid,
            displayName: data.displayName,
            timestamp: data.timestamp
          });
        }
      }
    });
    
    callback(typingUsers);
  });
  
  return unsubscribe;
};

/**
 * Format typing indicator message
 */
export const formatTypingMessage = (typingUsers: TypingUser[]): string => {
  if (typingUsers.length === 0) return '';
  
  if (typingUsers.length === 1) {
    return `${typingUsers[0].displayName} is typing...`;
  }
  
  if (typingUsers.length === 2) {
    return `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing...`;
  }
  
  if (typingUsers.length === 3) {
    return `${typingUsers[0].displayName}, ${typingUsers[1].displayName}, and ${typingUsers[2].displayName} are typing...`;
  }
  
  // 4 or more people
  return 'Several people are typing...';
};
