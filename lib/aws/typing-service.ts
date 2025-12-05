import { typingService } from './dynamodb-client';

interface TypingUser {
  uid: string;
  displayName: string;
  timestamp: number;
}

/**
 * Set typing status for a user in a conversation
 */
export const setTypingStatus = async (
  conversationId: string,
  userId: string,
  displayName: string,
  isTyping: boolean
) => {
  try {
    await typingService.setTyping(conversationId, userId, isTyping);
  } catch (error) {
    console.error('Error setting typing status:', error);
  }
};

/**
 * Subscribe to typing status changes in a conversation
 * Note: This uses polling since DynamoDB doesn't support real-time subscriptions
 */
export const subscribeToTypingStatus = (
  conversationId: string,
  currentUserId: string,
  callback: (typingUsers: TypingUser[]) => void
) => {
  // Poll for typing users every second
  const fetchTypingUsers = async () => {
    try {
      const userIds = await typingService.getTypingUsers(conversationId);
      const typingUsers: TypingUser[] = userIds
        .filter(uid => uid !== currentUserId)
        .map(uid => ({
          uid,
          displayName: uid, // We'd need to fetch actual display names from userService
          timestamp: Date.now()
        }));
      callback(typingUsers);
    } catch (error) {
      console.error('Error fetching typing users:', error);
      callback([]);
    }
  };

  fetchTypingUsers();
  const interval = setInterval(fetchTypingUsers, 1000);

  // Return unsubscribe function
  return () => clearInterval(interval);
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