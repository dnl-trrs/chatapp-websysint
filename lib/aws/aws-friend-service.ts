// AWS DynamoDB implementation of friend service
import { friendService } from './dynamodb-client';

export interface FriendRequest {
  id?: string;
  requestId?: string;
  fromUserId: string;
  toUserId: string;
  fromDisplayName?: string;
  toDisplayName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  updatedAt?: number;
}

export interface Friend {
  userId: string;
  friendId: string;
  displayName?: string;
  photoURL?: string;
  username?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  addedAt: number;
}

/**
 * Send a friend request to another user
 */
export const sendFriendRequest = async (
  fromUserId: string,
  toUserId: string,
  fromDisplayName?: string,
  toDisplayName?: string
): Promise<void> => {
  try {
    // Check if already friends
    const friends = await getFriends(fromUserId);
    const alreadyFriends = friends.some(f => f.userId === toUserId || f.friendId === toUserId);
    if (alreadyFriends) {
      throw new Error('You are already friends with this user');
    }

    // Check for existing pending request
    const pendingRequests = await getPendingRequests(toUserId);
    const existingRequest = pendingRequests.some(
      r => (r.fromUserId === fromUserId && r.toUserId === toUserId) ||
           (r.fromUserId === toUserId && r.toUserId === fromUserId)
    );
    if (existingRequest) {
      throw new Error('A friend request is already pending with this user');
    }

    // Send the request
    await friendService.sendFriendRequest(fromUserId, toUserId);
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

/**
 * Accept a friend request
 */
export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  try {
    await friendService.acceptFriendRequest(requestId);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

/**
 * Reject a friend request
 */
export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  try {
    await friendService.rejectFriendRequest(requestId);
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
};

/**
 * Remove a friend
 */
export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
  try {
    await friendService.removeFriend(userId, friendId);
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

/**
 * Get all friends for a user
 */
export const getFriends = async (userId: string): Promise<Friend[]> => {
  try {
    const friends = await friendService.getFriends(userId);
    return friends.map((f: any) => ({
      userId: f.userId,
      friendId: f.friendId,
      displayName: f.displayName,
      photoURL: f.photoURL,
      username: f.username,
      status: f.status,
      addedAt: f.createdAt || Date.now()
    }));
  } catch (error) {
    console.error('Error getting friends:', error);
    return [];
  }
};

/**
 * Get pending friend requests for a user
 */
export const getPendingRequests = async (userId: string): Promise<FriendRequest[]> => {
  try {
    const requests = await friendService.getPendingRequests(userId);
    return requests.map((r: any) => ({
      id: r.requestId,
      requestId: r.requestId,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  } catch (error) {
    console.error('Error getting pending requests:', error);
    return [];
  }
};

/**
 * Check if two users are friends
 */
export const checkIfFriends = async (userId: string, friendId: string): Promise<boolean> => {
  try {
    const friends = await getFriends(userId);
    return friends.some((f: Friend) => f.userId === friendId || f.friendId === friendId);
  } catch (error) {
    console.error('Error checking friendship:', error);
    return false;
  }
};

/**
 * Get the friend status between two users
 */
export const getFriendStatus = async (
  userId: string,
  targetUserId: string
): Promise<'none' | 'friends' | 'pending_sent' | 'pending_received'> => {
  try {
    // Check if they're already friends
    const areFriends = await checkIfFriends(userId, targetUserId);
    if (areFriends) {
      return 'friends';
    }

    // Check for pending requests
    const sentRequests = await friendService.getPendingRequests(targetUserId);
    const receivedRequests = await friendService.getPendingRequests(userId);

    const hasSentRequest = sentRequests.some(
      (r: any) => r.fromUserId === userId && r.toUserId === targetUserId && r.status === 'pending'
    );
    if (hasSentRequest) {
      return 'pending_sent';
    }

    const hasReceivedRequest = receivedRequests.some(
      (r: any) => r.fromUserId === targetUserId && r.toUserId === userId && r.status === 'pending'
    );
    if (hasReceivedRequest) {
      return 'pending_received';
    }

    return 'none';
  } catch (error) {
    console.error('Error getting friend status:', error);
    return 'none';
  }
};

/**
 * Search users by username/handle
 */
export const searchUsersByHandle = async (
  searchTerm: string,
  currentUserId: string
): Promise<any[]> => {
  try {
    if (!searchTerm) {
      return [];
    }
    const trimmed = searchTerm.trim().replace(/^@/, '');
    if (trimmed.length < 2) {
      return [];
    }

    const { userService } = await import('./dynamodb-client');
    const users = await userService.searchUsers(trimmed);
    return users.filter((u: any) => u.userId !== currentUserId);
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};

// Real-time subscriptions (not implemented in DynamoDB - would need WebSockets)
export const subscribeToPendingRequests = (
  userId: string,
  callback: (requests: FriendRequest[]) => void
): () => void => {
  // Poll for updates every 5 seconds
  const interval = setInterval(async () => {
    const requests = await getPendingRequests(userId);
    callback(requests);
  }, 5000);

  // Return unsubscribe function
  return () => clearInterval(interval);
};

export const subscribeToFriends = (
  userId: string,
  callback: (friends: Friend[]) => void
): () => void => {
  // Poll for updates every 5 seconds
  const interval = setInterval(async () => {
    const friends = await getFriends(userId);
    callback(friends);
  }, 5000);

  // Return unsubscribe function
  return () => clearInterval(interval);
};
