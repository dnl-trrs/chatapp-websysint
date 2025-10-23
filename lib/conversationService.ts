import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  addDoc,
  limit
} from 'firebase/firestore';

export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  participants: string[];
  name?: string; // For group chats
  icon?: string; // For group chats
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  hiddenBy?: string[]; // Users who have hidden this conversation
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: Timestamp;
  readBy: string[];
  editedAt?: Timestamp;
}

const GROUP_CHAT_LIMIT = 10;

// Create or get existing DM conversation
export const createOrGetDMConversation = async (
  userId1: string,
  userId2: string
): Promise<string> => {
  try {
    // Check if DM already exists
    const q1 = query(
      collection(db, 'conversations'),
      where('type', '==', 'dm'),
      where('participants', 'array-contains', userId1)
    );
    
    const snapshot = await getDocs(q1);
    const existingDM = snapshot.docs.find(doc => {
      const data = doc.data();
      return data.participants.includes(userId2) && data.participants.length === 2;
    });

    if (existingDM) {
      // Unhide the conversation for both users when re-opening a DM
      const data = existingDM.data();
      const hiddenBy = data.hiddenBy || [];
      
      // Check if either user has hidden the conversation
      const usersToUnhide = [userId1, userId2].filter(uid => hiddenBy.includes(uid));
      
      if (usersToUnhide.length > 0) {
        // Update to remove both users from hiddenBy array
        await updateDoc(doc(db, 'conversations', existingDM.id), {
          hiddenBy: hiddenBy.filter((uid: string) => !usersToUnhide.includes(uid)),
          updatedAt: serverTimestamp()
        });
      }
      return existingDM.id;
    }

    // Create new DM
    const conversationData = {
      type: 'dm',
      participants: [userId1, userId2],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId1
    };

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    
    // Add conversation to both users' conversation lists
    // Handle cases where user documents might not exist
    for (const userId of [userId1, userId2]) {
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Create a minimal user document if it doesn't exist
          await setDoc(userDocRef, {
            conversations: [docRef.id],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(userDocRef, {
            conversations: arrayUnion(docRef.id),
            updatedAt: serverTimestamp()
          });
        }
      } catch (updateError) {
        console.error(`Failed to update user ${userId}:`, updateError);
        // Don't fail if one user update fails - conversation is already created
      }
    }

    return docRef.id;
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
    console.log('Creating group chat:', { creatorId, participantIds, name });
    
    // Include creator in participants
    const allParticipants = [...new Set([creatorId, ...participantIds])];
    console.log('All participants:', allParticipants);
    
    if (allParticipants.length > GROUP_CHAT_LIMIT) {
      throw new Error(`Group chats are limited to ${GROUP_CHAT_LIMIT} participants. Consider creating a server instead.`);
    }

    const conversationData = {
      type: 'group',
      participants: allParticipants,
      name,
      icon: icon || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: creatorId
    };
    
    console.log('Conversation data to create:', conversationData);

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    console.log('Group chat created with ID:', docRef.id);
    
    // Add conversation to all participants' conversation lists
    // This might fail if users don't have profiles yet
    for (const participantId of allParticipants) {
      try {
        console.log('Checking if user document exists for:', participantId);
        const userDocRef = doc(db, 'users', participantId);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          console.log('User document does not exist for:', participantId, '- creating it');
          // Create a minimal user document if it doesn't exist
          await setDoc(userDocRef, {
            conversations: [docRef.id],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          console.log('Updating existing user document for:', participantId);
          await updateDoc(userDocRef, {
            conversations: arrayUnion(docRef.id),
            updatedAt: serverTimestamp()
          });
        }
        console.log('Successfully processed user:', participantId);
      } catch (updateError) {
        console.error(`Failed to update user ${participantId}:`, updateError);
        // Don't fail the entire operation if one user update fails
        // The conversation is already created
      }
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating group chat:', error);
    throw error;
  }
};

// Add participants to group chat
export const addParticipantsToGroup = async (
  conversationId: string,
  newParticipantIds: string[],
  addedBy: string
): Promise<void> => {
  try {
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationDoc.exists()) {
      throw new Error('Conversation not found');
    }

    const data = conversationDoc.data();
    if (data.type !== 'group') {
      throw new Error('Can only add participants to group chats');
    }

    const currentParticipants = data.participants || [];
    const allParticipants = [...new Set([...currentParticipants, ...newParticipantIds])];
    
    if (allParticipants.length > GROUP_CHAT_LIMIT) {
      throw new Error(`Group chats are limited to ${GROUP_CHAT_LIMIT} participants`);
    }

    // Update conversation
    await updateDoc(doc(db, 'conversations', conversationId), {
      participants: allParticipants,
      updatedAt: serverTimestamp()
    });

    // Add conversation to new participants' lists
    for (const participantId of newParticipantIds) {
      await updateDoc(doc(db, 'users', participantId), {
        conversations: arrayUnion(conversationId),
        updatedAt: serverTimestamp()
      });
    }

    // Add system message about new participants
    await sendSystemMessage(
      conversationId,
      `${addedBy} added ${newParticipantIds.length} participant(s) to the group`
    );
  } catch (error) {
    console.error('Error adding participants:', error);
    throw error;
  }
};

// Convert DM to group chat
export const convertDMToGroup = async (
  dmConversationId: string,
  newParticipantIds: string[],
  groupName: string,
  initiatorId: string
): Promise<string> => {
  try {
    const dmDoc = await getDoc(doc(db, 'conversations', dmConversationId));
    if (!dmDoc.exists()) {
      throw new Error('DM conversation not found');
    }

    const dmData = dmDoc.data();
    if (dmData.type !== 'dm') {
      throw new Error('Can only convert DM conversations to groups');
    }

    const allParticipants = [...new Set([...dmData.participants, ...newParticipantIds])];
    
    if (allParticipants.length > GROUP_CHAT_LIMIT) {
      throw new Error(`Group chats are limited to ${GROUP_CHAT_LIMIT} participants`);
    }

    // Create new group chat
    const groupId = await createGroupChat(initiatorId, allParticipants, groupName);
    
    // Copy messages from DM to new group (optional)
    // You might want to implement this based on your requirements

    return groupId;
  } catch (error) {
    console.error('Error converting DM to group:', error);
    throw error;
  }
};

// Get user's conversations (DMs and groups)
export const getUserConversations = async (
  userId: string,
  type?: 'dm' | 'group' | 'all'
): Promise<Conversation[]> => {
  try {
    let q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    if (type && type !== 'all') {
      q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId),
        where('type', '==', type),
        orderBy('updatedAt', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Conversation));
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
    // Get conversation to check who has hidden it
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationDoc.exists()) {
      throw new Error('Conversation not found');
    }
    
    const conversationData = conversationDoc.data();
    const hiddenBy = conversationData.hiddenBy || [];
    
    // Get sender's display name for the last message preview
    const senderDoc = await getDoc(doc(db, 'users', senderId));
    const senderData = senderDoc.exists() ? senderDoc.data() : {};
    const senderDisplayName = senderData.displayName || 'Unknown User';
    
    // Add message to messages subcollection
    const messageData = {
      conversationId,
      senderId,
      text,
      timestamp: serverTimestamp(),
      readBy: [senderId],
      displayName: senderDisplayName,
      photoURL: senderData.photoURL || ''
    };

    await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

    // Unhide conversation for all participants except the sender when a new message arrives
    const participantsToUnhide = conversationData.participants.filter(
      (p: string) => p !== senderId && hiddenBy.includes(p)
    );
    
    // Update conversation's last message and unhide for recipients
    const updateData: any = {
      lastMessage: {
        text,
        senderId,
        senderDisplayName,
        timestamp: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    };
    
    // Remove users from hiddenBy array if they had hidden the conversation
    if (participantsToUnhide.length > 0) {
      updateData.hiddenBy = hiddenBy.filter((uid: string) => !participantsToUnhide.includes(uid));
    }
    
    await updateDoc(doc(db, 'conversations', conversationId), updateData);
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Send system message
const sendSystemMessage = async (
  conversationId: string,
  text: string
): Promise<void> => {
  try {
    const messageData = {
      conversationId,
      senderId: 'system',
      text,
      timestamp: serverTimestamp(),
      readBy: []
    };

    await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);
  } catch (error) {
    console.error('Error sending system message:', error);
  }
};

// Subscribe to conversation messages
export const subscribeToConversationMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void
) => {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
    callback(messages);
  });
};

// Subscribe to conversation updates
export const subscribeToConversation = (
  conversationId: string,
  callback: (conversation: Conversation | null) => void
) => {
  return onSnapshot(doc(db, 'conversations', conversationId), (doc) => {
    if (doc.exists()) {
      callback({
        id: doc.id,
        ...doc.data()
      } as Conversation);
    } else {
      callback(null);
    }
  });
};

// Subscribe to all user conversations with real-time updates
export const subscribeToUserConversations = (
  userId: string,
  callback: (conversations: Conversation[]) => void
) => {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Conversation));
    callback(conversations);
  });
};

// Mark messages as read
export const markMessagesAsRead = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      where('readBy', 'not-in', [[userId]])
    );
    
    const snapshot = await getDocs(q);
    const batch: Promise<void>[] = [];
    
    snapshot.docs.forEach(doc => {
      batch.push(
        updateDoc(doc.ref, {
          readBy: arrayUnion(userId)
        })
      );
    });
    
    await Promise.all(batch);
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
};

// Remove participant from group chat (owner/admin only)
export const removeParticipantFromGroup = async (
  conversationId: string,
  participantId: string,
  removedBy: string
): Promise<void> => {
  try {
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationDoc.exists()) {
      throw new Error('Conversation not found');
    }

    const data = conversationDoc.data();
    if (data.type !== 'group') {
      throw new Error('Can only remove participants from group chats');
    }

    // Check if the user doing the removal is the creator
    if (data.createdBy !== removedBy) {
      throw new Error('Only the group creator can remove participants');
    }

    // Can't remove the creator
    if (participantId === data.createdBy) {
      throw new Error('Cannot remove the group creator');
    }

    // Remove participant from conversation
    await updateDoc(doc(db, 'conversations', conversationId), {
      participants: arrayRemove(participantId),
      updatedAt: serverTimestamp()
    });

    // Remove conversation from participant's list
    try {
      await updateDoc(doc(db, 'users', participantId), {
        conversations: arrayRemove(conversationId),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.warn(`Failed to remove conversation from user ${participantId}:`, error);
    }

    // Add system message
    const removedByDoc = await getDoc(doc(db, 'users', removedBy));
    const removedByName = removedByDoc.exists() ? removedByDoc.data().displayName : 'Admin';
    const participantDoc = await getDoc(doc(db, 'users', participantId));
    const participantName = participantDoc.exists() ? participantDoc.data().displayName : 'User';
    
    await sendSystemMessage(conversationId, `${removedByName} removed ${participantName} from the group`);
  } catch (error) {
    console.error('Error removing participant from group:', error);
    throw error;
  }
};

// Leave group chat
export const leaveGroupChat = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationDoc.exists()) {
      throw new Error('Conversation not found');
    }

    const data = conversationDoc.data();
    if (data.type !== 'group') {
      throw new Error('Can only leave group chats');
    }

    // Remove user from conversation
    await updateDoc(doc(db, 'conversations', conversationId), {
      participants: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });

    // Remove conversation from user's list
    await updateDoc(doc(db, 'users', userId), {
      conversations: arrayRemove(conversationId),
      updatedAt: serverTimestamp()
    });

    // Add system message
    await sendSystemMessage(conversationId, `${userId} left the group`);
  } catch (error) {
    console.error('Error leaving group chat:', error);
    throw error;
  }
};

// Get conversation with participant details
export const getConversationWithDetails = async (
  conversationId: string
): Promise<any> => {
  try {
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationDoc.exists()) {
      return null;
    }

    const conversationData: any = {
      id: conversationDoc.id,
      ...conversationDoc.data()
    };

    // Get participant details
    const participants: any[] = [];
    for (const participantId of conversationData.participants) {
      const userDoc = await getDoc(doc(db, 'users', participantId));
      if (userDoc.exists()) {
        participants.push({
          id: participantId,
          ...userDoc.data()
        });
      }
    }

    return {
      ...conversationData,
      participantDetails: participants
    };
  } catch (error) {
    console.error('Error getting conversation details:', error);
    return null;
  }
};

// Hide conversation for a user
export const hideConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      hiddenBy: arrayUnion(userId),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error hiding conversation:', error);
    throw error;
  }
};

// Unhide conversation for a user
export const unhideConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      hiddenBy: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error unhiding conversation:', error);
    throw error;
  }
};

// Rename group chat
export const renameGroupChat = async (
  conversationId: string,
  newName: string,
  userId: string
): Promise<void> => {
  try {
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationDoc.exists()) {
      throw new Error('Conversation not found');
    }

    const data = conversationDoc.data();
    if (data.type !== 'group') {
      throw new Error('Can only rename group chats');
    }

    await updateDoc(doc(db, 'conversations', conversationId), {
      name: newName,
      updatedAt: serverTimestamp()
    });

    // Add system message
    await sendSystemMessage(conversationId, `Group renamed to "${newName}"`);
  } catch (error) {
    console.error('Error renaming group chat:', error);
    throw error;
  }
};

// Delete group chat (only creator can delete)
export const deleteGroupChat = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    console.log('Attempting to delete group chat:', { conversationId, userId });
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationDoc.exists()) {
      throw new Error('Conversation not found');
    }

    const data = conversationDoc.data();
    console.log('Group chat data:', { 
      type: data.type, 
      createdBy: data.createdBy, 
      participants: data.participants,
      userId 
    });
    
    if (data.type !== 'group') {
      throw new Error('Can only delete group chats');
    }

    if (data.createdBy !== userId) {
      throw new Error(`Only the creator can delete the group chat. Creator: ${data.createdBy}, User: ${userId}`);
    }

    // First, delete the conversation document
    // This must be done while the user still has permissions (as creator)
    await deleteDoc(doc(db, 'conversations', conversationId));
    
    // After deleting the conversation, clean up user references
    // These updates might fail if users have been deleted, so we catch errors
    for (const participantId of data.participants) {
      try {
        await updateDoc(doc(db, 'users', participantId), {
          conversations: arrayRemove(conversationId),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn(`Failed to remove conversation from user ${participantId}:`, error);
      }
    }
    
    // Note: Messages subcollection will be automatically deleted by Firestore
    // when the parent document is deleted (eventually consistent)
  } catch (error) {
    console.error('Error deleting group chat:', error);
    throw error;
  }
};
