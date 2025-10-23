"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { 
  getFriends, 
  searchUsersByHandle, 
  sendFriendRequest,
  removeFriend,
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  Friend
} from '@/lib/friendService';
import { createOrGetDMConversation } from '@/lib/conversationService';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat?: (conversationId: string) => void;
}

const FriendsModal: React.FC<FriendsModalProps> = ({ isOpen, onClose, onStartChat }) => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useToast();
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'add'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load friends and pending requests when modal opens with auto-refresh
  useEffect(() => {
    if (isOpen && user?.uid) {
      loadFriends();
      loadPendingRequests();
      
      // Auto-refresh pending requests every 3 seconds while modal is open
      const interval = setInterval(() => {
        loadPendingRequests();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen, user?.uid]);

  // Search users
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2 || !user?.uid || activeTab !== 'add') {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearching(true);
      try {
        const results = await searchUsersByHandle(searchTerm, user.uid);
        // Filter out existing friends
        const friendIds = friends.map(f => f.uid);
        const filteredResults = results.filter(r => !friendIds.includes(r.id));
        setSearchResults(filteredResults);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, user?.uid, friends, activeTab]);

  const loadFriends = async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    try {
      const userFriends = await getFriends(user.uid);
      setFriends(userFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    if (!user?.uid) return;
    try {
      const requests = await getPendingRequests(user.uid);
      // Filter to only show incoming requests (where user is the recipient)
      const incomingRequests = requests.filter(req => req.toUid === user.uid);
      setPendingRequests(incomingRequests);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const handleSendFriendRequest = async (targetUser: any) => {
    if (!user?.uid) return;
    
    try {
      await sendFriendRequest(
        user.uid,
        targetUser.id,
        user.displayName || 'User',
        targetUser.displayName || targetUser.username
      );
      showToast('Friend request sent successfully!', 'success');
      setSearchResults(searchResults.filter(r => r.id !== targetUser.id));
    } catch (error: any) {
      showToast(error.message || 'Failed to send friend request', 'error');
    }
  };

  const handleAcceptRequest = async (request: any) => {
    try {
      await acceptFriendRequest(request.fromUid, request.toUid);
      await loadFriends();
      await loadPendingRequests();
      showToast('Friend request accepted!', 'success');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      showToast('Failed to accept friend request', 'error');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      await loadPendingRequests();
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      showToast('Failed to reject friend request', 'error');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user?.uid) return;
    
    showConfirm(
      'Are you sure you want to remove this friend?',
      async () => {
        try {
          await removeFriend(user.uid, friendId);
          await loadFriends();
          showToast('Friend removed', 'success');
        } catch (error) {
          console.error('Error removing friend:', error);
          showToast('Failed to remove friend', 'error');
        }
      },
      'Remove Friend'
    );
  };

  const handleStartChat = async (friendId: string) => {
    if (!user?.uid) return;
    
    try {
      const conversationId = await createOrGetDMConversation(user.uid, friendId);
      if (onStartChat) {
        onStartChat(conversationId);
      }
      onClose();
    } catch (error) {
      console.error('Error starting chat:', error);
      showToast('Failed to start chat', 'error');
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-[#22c55e]';
      case 'idle': return 'bg-[#eab308]';
      case 'dnd': return 'bg-[#ef4444]';
      default: return 'bg-[#71717a]';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-dark rounded-xl w-full max-w-2xl max-h-[700px] flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#e4e4e7]">Friends</h2>
            <button
              onClick={onClose}
              className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-[#27272a]">
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-4 py-2 text-sm font-medium transition-all relative ${
                activeTab === 'friends' 
                  ? 'text-[#e4e4e7]' 
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              Your Friends ({friends.length})
              {activeTab === 'friends' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 text-sm font-medium transition-all relative flex items-center gap-2 ${
                activeTab === 'pending' 
                  ? 'text-[#e4e4e7]' 
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              Pending
              {pendingRequests.length > 0 && (
                <span className="bg-[#ef4444] text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {pendingRequests.length}
                </span>
              )}
              {activeTab === 'pending' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`px-4 py-2 text-sm font-medium transition-all relative ${
                activeTab === 'add' 
                  ? 'text-[#e4e4e7]' 
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              Add Friend
              {activeTab === 'add' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden">
          {activeTab === 'friends' ? (
            <div className="h-full overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8">
                  <p className="text-[#71717a]">Loading friends...</p>
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-4">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="#71717a">
                      <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z"/>
                      <path d="M20.0001 10.0001V7.00006H18.0001V10.0001H15.0001V12.0001H18.0001V15.0001H20.0001V12.0001H23.0001V10.0001H20.0001Z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">No friends yet</h3>
                  <p className="text-[#71717a] text-sm mb-4">
                    Start by adding some friends to chat with!
                  </p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="btn btn-primary px-4 py-2 text-sm"
                  >
                    Add Friends
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(friend => (
                    <div 
                      key={friend.uid} 
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-[#18181b] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {friend.photoURL ? (
                            <Image
                              src={friend.photoURL}
                              alt={friend.displayName}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white font-semibold">
                              {friend.displayName?.[0] || friend.username?.[0] || '?'}
                            </div>
                          )}
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(friend.status)} rounded-full border-2 border-[#18181b]`} />
                        </div>
                        <div>
                          <p className="text-sm text-[#e4e4e7] font-medium">{friend.displayName}</p>
                          <p className="text-xs text-[#71717a]">@{friend.username}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartChat(friend.uid)}
                          className="p-2 rounded-lg hover:bg-[#27272a] transition-colors text-[#71717a] hover:text-[#818cf8]"
                          title="Start Chat"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4.79805 3C3.80445 3 2.99805 3.8055 2.99805 4.8V15.6C2.99805 16.5936 3.80445 17.4 4.79805 17.4H7.49805V21L11.098 17.4H19.198C20.1925 17.4 20.998 16.5936 20.998 15.6V4.8C20.998 3.8055 20.1925 3 19.198 3H4.79805Z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(friend.uid)}
                          className="p-2 rounded-lg hover:bg-[#27272a] transition-colors text-[#71717a] hover:text-[#ef4444] opacity-0 group-hover:opacity-100"
                          title="Remove Friend"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z"/>
                            <path d="M14 14L18 18M18 14L14 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'pending' ? (
            // Pending Requests Tab
            <div className="h-full overflow-y-auto">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-4">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="#71717a">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">No pending requests</h3>
                  <p className="text-[#71717a] text-sm">
                    When someone sends you a friend request, it will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#71717a] mb-3">
                    {pendingRequests.length} pending friend request{pendingRequests.length !== 1 ? 's' : ''}
                  </p>
                  {pendingRequests.map(request => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-[#18181b] border border-[#27272a]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white font-semibold">
                          {request.fromDisplayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm text-[#e4e4e7] font-medium">{request.fromDisplayName}</p>
                          <p className="text-xs text-[#71717a]">Wants to be your friend</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAcceptRequest(request)}
                          className="px-3 py-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm rounded-lg transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-sm rounded-lg transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Add Friend Tab
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#a1a1aa] mb-2 block">Search by username</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter username (e.g., johndoe)..."
                  className="input w-full"
                  autoFocus
                />
                <p className="text-xs text-[#71717a] mt-1">
                  Enter at least 2 characters to search
                </p>
              </div>

              {isSearching && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#818cf8]"></div>
                  <p className="text-sm text-[#71717a] mt-2">Searching...</p>
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  <p className="text-xs text-[#71717a] mb-2">
                    Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  {searchResults.map(result => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-[#18181b] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white font-semibold">
                          {result.displayName?.[0]?.toUpperCase() || result.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-[#e4e4e7]">{result.displayName}</p>
                          <p className="text-xs text-[#71717a]">@{result.username}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendFriendRequest(result)}
                        className="btn btn-primary px-4 py-1.5 text-sm"
                      >
                        Add Friend
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!isSearching && searchTerm.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[#71717a]">No users found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsModal;
