// AWS DynamoDB implementation of conversation service
import { conversationService, messageService } from './dynamodb-client';

export interface Conversation {
  id: string;
  conversationId?: string;
  type: 'dm' | 'group';
  participants: string[];
  name?: string;
  icon?: string;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: number;
  };
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  hiddenBy?: string[];
}

export interface Message {
  id: string;
  messageId?: string;
  conversationId: string;
  senderId: string;
  text: string;
  content?: string;
  timestamp: number;
  readBy?: string[];
  editedAt?: number;
  displayName?: string;
  photoURL?: string;
}

const GROUP_CHAT_LIMIT = 10;

// Create or get existing DM conversation
export const createOrGetDMConversation = async (
  userId1: string,
  userId2: string
): Promise<string> => {
  try {
    // Check if DM already exists
    const userConversations = await conversationService.getUserConversations(userId1);
    const existingDM = userConversations.find((conv: any) => {
      return conv.type === 'dm' && 
             conv.participants?.includes(userId2) && 
             conv.participants?.length === 2;
    });

    if (existingDM) {
      // Unhide if hidden
      if (existingDM.hiddenBy?.includes(userId1)) {
        await conversationService.updateConversation(existingDM.conversationId, {
          hiddenBy: existingDM.hiddenBy.filter((id: string) => id !== userId1)
        });
      }
      return existingDM.conversationId;
    }

    // Create new DM
    const conversationData = {
      type: 'dm',
      participants: [userId1, userId2],
      createdBy: userId1,
      userId: userId1 // For UserIndex
    };

    const newConversation = await conversationService.createConversation(conversationData);
    return newConversation.conversationId;
  } catch (error) {
    console.error('Error creating DM conversation:', error);
    throw error;
  }
};

// Create group chat
export const createGroupChat = async (
  creatorId: string,
  participantIds: string[],
  name: string,
  icon?: string
): Promise<string> => {
  try {
    const allParticipants = [...new Set([creatorId, ...participantIds])];
    
    if (allParticipants.length > GROUP_CHAT_LIMIT) {
      throw new Error(`Group chats are limited to ${GROUP_CHAT_LIMIT} participants.`);
    }

    const conversationData = {
      type: 'group',
      participants: allParticipants,
      name,
      icon: icon || '',
      createdBy: creatorId,
      userId: creatorId // For UserIndex
    };

    const newConversation = await conversationService.createConversation(conversationData);
    return newConversation.conversationId;
  } catch (error) {
    console.error('Error creating group chat:', error);
    throw error;
  }
};

// Get user's conversations
export const getUserConversations = async (
  userId: string,
  type?: 'dm' | 'group' | 'all'
): Promise<Conversation[]> => {
  try {
    const conversations = await conversationService.getUserConversations(userId);
    
    let filtered = conversations;
    if (type && type !== 'all') {
      filtered = conversations.filter((c: any) => c.type === type);
    }

    return filtered.map((c: any) => ({
      id: c.conversationId,
      conversationId: c.conversationId,
      type: c.type,
      participants: c.participants || [],
      name: c.name,
      icon: c.icon,
      lastMessage: c.lastMessage,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      createdBy: c.createdBy,
      hiddenBy: c.hiddenBy
    }));
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return [];
  }
};

// Send message to conversation
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  text: string
): Promise<void> => {
  try {
    const messageData = {
      senderId,
      content: text,
      text,
      readBy: [senderId]
    };

    await messageService.sendMessage(conversationId, messageData);
    
    // Update conversation's last message
    await conversationService.updateConversation(conversationId, {
      lastMessage: {
        text,
        senderId,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Get messages for a conversation
export const getMessages = async (
  conversationId: string,
  limit: number = 50
): Promise<Message[]> => {
  try {
    const messages = await messageService.getMessages(conversationId, limit);
    return messages.map((m: any) => ({
      id: m.messageId,
      messageId: m.messageId,
      conversationId: m.conversationId,
      senderId: m.senderId,
      text: m.content || m.text,
      content: m.content,
      timestamp: m.timestamp,
      readBy: m.readBy || [],
      editedAt: m.editedAt,
      displayName: m.displayName,
      photoURL: m.photoURL
    }));
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
};

// Add participants to group chat
export const addParticipantsToGroup = async (
  conversationId: string,
  newParticipantIds: string[],
  addedBy: string
): Promise<void> => {
  try {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.type !== 'group') {
      throw new Error('Can only add participants to group chats');
    }

    const currentParticipants = conversation.participants || [];
    const allParticipants = [...new Set([...currentParticipants, ...newParticipantIds])];
    
    if (allParticipants.length > GROUP_CHAT_LIMIT) {
      throw new Error(`Group chats are limited to ${GROUP_CHAT_LIMIT} participants`);
    }

    await conversationService.updateConversation(conversationId, {
      participants: allParticipants
    });

    // Add system message
    await sendMessage(conversationId, 'system', 
      `${addedBy} added ${newParticipantIds.length} participant(s) to the group`);
  } catch (error) {
    console.error('Error adding participants:', error);
    throw error;
  }
};

// Remove participant from group
export const removeParticipantFromGroup = async (
  conversationId: string,
  participantId: string,
  removedBy: string
): Promise<void> => {
  try {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.type !== 'group') {
      throw new Error('Can only remove participants from group chats');
    }

    if (conversation.createdBy !== removedBy) {
      throw new Error('Only the group creator can remove participants');
    }

    const newParticipants = (conversation.participants || []).filter(
      (p: string) => p !== participantId
    );

    await conversationService.updateConversation(conversationId, {
      participants: newParticipants
    });

    await sendMessage(conversationId, 'system', 
      `${removedBy} removed ${participantId} from the group`);
  } catch (error) {
    console.error('Error removing participant:', error);
    throw error;
  }
};

// Leave group chat
export const leaveGroupChat = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.type !== 'group') {
      throw new Error('Can only leave group chats');
    }

    const newParticipants = (conversation.participants || []).filter(
      (p: string) => p !== userId
    );

    await conversationService.updateConversation(conversationId, {
      participants: newParticipants
    });

    await sendMessage(conversationId, 'system', `${userId} left the group`);
  } catch (error) {
    console.error('Error leaving group chat:', error);
    throw error;
  }
};

// Hide conversation
export const hideConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const hiddenBy = conversation.hiddenBy || [];
    if (!hiddenBy.includes(userId)) {
      hiddenBy.push(userId);
    }

    await conversationService.updateConversation(conversationId, {
      hiddenBy
    });
  } catch (error) {
    console.error('Error hiding conversation:', error);
    throw error;
  }
};

// Unhide conversation
export const unhideConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const hiddenBy = (conversation.hiddenBy || []).filter((id: string) => id !== userId);

    await conversationService.updateConversation(conversationId, {
      hiddenBy
    });
  } catch (error) {
    console.error('Error unhiding conversation:', error);
    throw error;
  }
};

// Get conversation with details
export const getConversationWithDetails = async (
  conversationId: string
): Promise<any> => {
  try {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      return null;
    }

    // Get participant details
    const { userService } = await import('./dynamodb-client');
    const participantDetails = await Promise.all(
      (conversation.participants || []).map(async (pId: string) => {
        try {
          const detail = await userService.getUser(pId);
          if (!detail) {
            return null;
          }
          return {
            ...detail,
            id: detail.userId || detail.id || pId,
            userId: detail.userId || pId
          };
        } catch (err) {
          console.error('Error fetching participant detail:', err);
          return null;
        }
      })
    );

    return {
      ...conversation,
      id: conversation.conversationId,
      participantDetails: participantDetails.filter(Boolean)
    };
  } catch (error) {
    console.error('Error getting conversation details:', error);
    return null;
  }
};

// Real-time subscriptions (polling-based for DynamoDB)
export const subscribeToConversationMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void
): () => void => {
  // Initial load
  getMessages(conversationId).then(callback);
  
  // Poll for new messages every second for better real-time feel
  const interval = setInterval(async () => {
    const messages = await getMessages(conversationId);
    callback(messages);
  }, 1000);

  // Return unsubscribe function
  return () => clearInterval(interval);
};

export const subscribeToConversation = (
  conversationId: string,
  callback: (conversation: Conversation | null) => void
): () => void => {
  // Poll for updates every 3 seconds
  const interval = setInterval(async () => {
    const conversation = await conversationService.getConversation(conversationId);
    if (conversation) {
      callback({
        id: conversation.conversationId,
        conversationId: conversation.conversationId,
        type: conversation.type,
        participants: conversation.participants || [],
        name: conversation.name,
        icon: conversation.icon,
        lastMessage: conversation.lastMessage,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        createdBy: conversation.createdBy,
        hiddenBy: conversation.hiddenBy
      });
    } else {
      callback(null);
    }
  }, 3000);

  return () => clearInterval(interval);
};

export const subscribeToUserConversations = (
  userId: string,
  callback: (conversations: Conversation[]) => void
): () => void => {
  // Initial load
  getUserConversations(userId).then(callback);
  
  // Poll for updates every 2 seconds for better responsiveness
  const interval = setInterval(async () => {
    const conversations = await getUserConversations(userId);
    callback(conversations);
  }, 2000);

  return () => clearInterval(interval);
};

// Mark messages as read
export const markMessagesAsRead = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    // In DynamoDB, we'd need to update each message individually
    // For now, this is a no-op as it would be expensive
    console.log('Marking messages as read:', { conversationId, userId });
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
};

// Rename group chat
export const renameGroupChat = async (
  conversationId: string,
  newName: string,
  userId: string
): Promise<void> => {
  try {
    await conversationService.updateConversation(conversationId, {
      name: newName
    });
    
    await sendMessage(conversationId, 'system', 
      `Group renamed to "${newName}"`);
  } catch (error) {
    console.error('Error renaming group chat:', error);
    throw error;
  }
};

// Delete group chat
export const deleteGroupChat = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.type !== 'group') {
      throw new Error('Can only delete group chats');
    }

    if (conversation.createdBy !== userId) {
      throw new Error('Only the creator can delete the group chat');
    }

    // In a real implementation, you'd mark it as deleted rather than hard delete
    // For now, hide it for all participants
    await conversationService.updateConversation(conversationId, {
      hiddenBy: conversation.participants || [],
      deleted: true,
      deletedAt: Date.now(),
      deletedBy: userId
    });
  } catch (error) {
    console.error('Error deleting group chat:', error);
    throw error;
  }
};

// Convert DM to group
export const convertDMToGroup = async (
  dmConversationId: string,
  newParticipantIds: string[],
  groupName: string,
  initiatorId: string
): Promise<string> => {
  try {
    const dmConversation = await conversationService.getConversation(dmConversationId);
    if (!dmConversation || dmConversation.type !== 'dm') {
      throw new Error('DM conversation not found');
    }

    const allParticipants = [...new Set([
      ...(dmConversation.participants || []),
      ...newParticipantIds
    ])];

    if (allParticipants.length > GROUP_CHAT_LIMIT) {
      throw new Error(`Group chats are limited to ${GROUP_CHAT_LIMIT} participants`);
    }

    // Create new group chat
    return await createGroupChat(initiatorId, allParticipants, groupName);
  } catch (error) {
    console.error('Error converting DM to group:', error);
    throw error;
  }
};
