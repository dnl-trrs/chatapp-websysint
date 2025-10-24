// Client-side DynamoDB service that uses API routes

// User operations
export const userService = {
  async createUser(userId: string, userData: any) {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...userData })
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
  },

  async getUser(userId: string) {
    const response = await fetch(`/api/users?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to get user');
    return response.json();
  },

  async updateUser(userId: string, updates: any) {
    const response = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, updates })
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  },

  async searchUsers(searchTerm: string) {
    const response = await fetch(`/api/users?search=${encodeURIComponent(searchTerm)}`);
    if (!response.ok) throw new Error('Failed to search users');
    return response.json();
  }
};

// For now, export placeholder services for other operations
// These will be implemented with their respective API routes
export const conversationService = {
  async createConversation(conversationData: any) {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversationData)
    });
    if (!response.ok) throw new Error('Failed to create conversation');
    return response.json();
  },
  
  async getConversation(conversationId: string) {
    const response = await fetch(`/api/conversations?conversationId=${conversationId}`);
    if (!response.ok) return null;
    return response.json();
  },
  
  async getUserConversations(userId: string) {
    const response = await fetch(`/api/conversations?userId=${userId}`);
    if (!response.ok) return [];
    return response.json();
  },
  
  async updateConversation(conversationId: string, updates: any) {
    const response = await fetch('/api/conversations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, updates })
    });
    if (!response.ok) throw new Error('Failed to update conversation');
    return response.json();
  }
};

export const messageService = {
  async sendMessage(conversationId: string, messageData: any) {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, ...messageData })
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },
  
  async getMessages(conversationId: string, limit: number = 50) {
    const response = await fetch(`/api/messages?conversationId=${conversationId}&limit=${limit}`);
    if (!response.ok) return [];
    return response.json();
  }
};

export const friendService = {
  async addFriend(userId: string, friendId: string) {
    // This is handled by accepting a friend request
    throw new Error('Use acceptFriendRequest instead');
  },
  
  async getFriends(userId: string) {
    const response = await fetch(`/api/friends?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to get friends');
    return response.json();
  },
  
  async removeFriend(userId: string, friendId: string) {
    const response = await fetch('/api/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, friendId })
    });
    if (!response.ok) throw new Error('Failed to remove friend');
  },
  
  async sendFriendRequest(fromUserId: string, toUserId: string) {
    const response = await fetch('/api/friend-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId, toUserId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send friend request');
    }
    return response.json();
  },
  
  async getPendingRequests(userId: string) {
    const response = await fetch(`/api/friend-requests?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to get pending requests');
    return response.json();
  },
  
  async acceptFriendRequest(requestId: string) {
    const response = await fetch('/api/friend-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action: 'accept' })
    });
    if (!response.ok) throw new Error('Failed to accept friend request');
  },
  
  async rejectFriendRequest(requestId: string) {
    const response = await fetch('/api/friend-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action: 'reject' })
    });
    if (!response.ok) throw new Error('Failed to reject friend request');
  }
};

export const typingService = {
  async setTyping(conversationId: string, userId: string, isTyping: boolean) {
    // TODO: Implement API route
  },
  
  async getTypingUsers(conversationId: string) {
    // TODO: Implement API route
    return [];
  }
};