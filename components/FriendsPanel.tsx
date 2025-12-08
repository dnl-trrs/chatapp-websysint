"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@/lib/aws/aws-friend-service';
import { createOrGetDMConversation } from '@/lib/aws/aws-conversation-service';
import UserProfileCard from './UserProfileCard';
import { userService } from '@/lib/aws/dynamodb-client';

interface FriendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat?: (conversationId: string) => void;
}

const FriendsPanel: React.FC<FriendsPanelProps> = ({ isOpen, onClose, onStartChat }) => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useToast();
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'add'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, any>>({});
  const profileCacheRef = useRef<Record<string, any>>({});

  const getOrLoadProfile = useCallback(async (userId?: string | null) => {
    if (!userId) return null;
    if (profileCacheRef.current[userId]) {
      return profileCacheRef.current[userId];
    }
    try {
      const profile = await userService.getUser(userId);
      if (profile) {
        profileCacheRef.current = { ...profileCacheRef.current, [userId]: profile };
        setProfileCache(profileCacheRef.current);
      }
      return profile;
    } catch (error) {
      console.error('Error loading profile for', userId, error);
      return null;
    }
  }, []);


  // Search users
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2 || !user?.uid || activeTab !== 'add') {
      setSearchResults([]);
      return;
    }

    let isCancelled = false;

    const searchUsers = async () => {
      setIsSearching(true);
      try {
        const results = await searchUsersByHandle(searchTerm, user.uid);
        const friendIds = friends.map(f => f.friendId);
        const filteredResults = results.filter(r => {
          const targetId = r.userId || r.id;
          return targetId ? !friendIds.includes(targetId) : true;
        });
        const enrichedResults = await Promise.all(
          filteredResults.map(async result => {
            const userId = result.userId || result.id;
            if (!userId) return result;
            const profile = await getOrLoadProfile(userId);
            if (!profile) return result;
            return {
              ...result,
              displayName: result.displayName || profile.displayName,
              username: result.username || profile.username,
              photoURL: result.photoURL || profile.photoURL
            };
          })
        );
        if (!isCancelled) {
          setSearchResults(enrichedResults);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        if (!isCancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => {
      isCancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [searchTerm, user?.uid, friends, activeTab, getOrLoadProfile]);

  const loadFriends = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    try {
      const userFriends = await getFriends(user.uid);
      const enrichedFriends = await Promise.all(
        userFriends.map(async friend => {
          const targetId = friend.friendId || friend.userId;
          if (!targetId) return friend;
          const profile = await getOrLoadProfile(targetId);
          return {
            ...friend,
            displayName: friend.displayName || profile?.displayName || friend.username || 'Unknown User',
            username: friend.username || profile?.username || friend.displayName || 'user',
            photoURL: friend.photoURL || profile?.photoURL,
            status: friend.status || profile?.status || 'offline'
          };
        })
      );
      setFriends(enrichedFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, getOrLoadProfile]);

  const loadPendingRequests = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const requests = await getPendingRequests(user.uid);
      const ids = new Set<string>();
      requests.forEach(req => {
        if (req.fromUserId && req.fromUserId !== user.uid) ids.add(req.fromUserId);
        if (req.toUserId && req.toUserId !== user.uid) ids.add(req.toUserId);
      });
      const profileMap: Record<string, any> = {};
      await Promise.all(
        Array.from(ids).map(async id => {
          const profile = await getOrLoadProfile(id);
          if (profile) {
            profileMap[id] = profile;
          }
        })
      );
      const enrichedRequests = requests.map(req => {
        const fromProfile = req.fromUserId ? (profileMap[req.fromUserId] || profileCacheRef.current[req.fromUserId]) : null;
        const toProfile = req.toUserId ? (profileMap[req.toUserId] || profileCacheRef.current[req.toUserId]) : null;
        return {
          ...req,
          fromDisplayName: req.fromDisplayName || fromProfile?.displayName,
          toDisplayName: req.toDisplayName || toProfile?.displayName,
          fromUsername: req.fromUsername || fromProfile?.username,
          toUsername: req.toUsername || toProfile?.username,
          fromPhotoURL: req.fromPhotoURL || fromProfile?.photoURL,
          toPhotoURL: req.toPhotoURL || toProfile?.photoURL
        };
      });
      setPendingRequests(enrichedRequests);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  }, [user?.uid, getOrLoadProfile]);

  // Load friends and pending requests when panel opens with auto-refresh
  useEffect(() => {
    if (isOpen && user?.uid) {
      loadFriends();
      loadPendingRequests();
      
      // Auto-refresh pending requests every 3 seconds while panel is open
      const interval = setInterval(() => {
        loadPendingRequests();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen, user?.uid, loadFriends, loadPendingRequests]);

  const handleSendFriendRequest = async (targetUser: any) => {
    if (!user?.uid) return;
    
    try {
      const targetUserId = targetUser.userId || targetUser.id;
      const cachedProfile = targetUserId ? profileCache[targetUserId] : null;
      await sendFriendRequest(
        user.uid,
        targetUserId,
        user.displayName || 'User',
        targetUser.displayName || cachedProfile?.displayName || targetUser.username
      );
      showToast('Friend request sent successfully!', 'success');
      setSearchResults(searchResults.filter(r => (r.userId || r.id) !== targetUserId));
    } catch (error: any) {
      showToast(error.message || 'Failed to send friend request', 'error');
    }
  };

  const handleAcceptRequest = async (request: any) => {
    try {
      await acceptFriendRequest(request.requestId || request.id);
      const otherUserId = request.fromUserId === user?.uid ? request.toUserId : request.fromUserId;
      if (otherUserId) {
        const profile = await getOrLoadProfile(otherUserId);
        if (profile) {
          setFriends(prev => {
            if (prev.some(f => f.friendId === otherUserId)) return prev;
            return [
              ...prev,
              {
                userId: profile.userId,
                friendId: otherUserId,
                displayName: profile.displayName || request.fromDisplayName || request.toDisplayName,
                username: profile.username || request.fromUsername || request.toUsername,
                photoURL: profile.photoURL,
                status: profile.status || 'offline',
                addedAt: request.createdAt || Date.now()
              }
            ];
          });
        }
      }
      setPendingRequests(prev => prev.filter(req => (req.requestId || req.id) !== (request.requestId || request.id)));
      loadFriends();
      loadPendingRequests();
      showToast('Friend request accepted!', 'success');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      showToast('Failed to accept friend request', 'error');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      setPendingRequests(prev => prev.filter(req => (req.requestId || req.id) !== requestId));
      loadPendingRequests();
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

  return (
    <>
      {/* Sliding Panel - slides up from underneath the profile tile */}
      <div 
        className={`fixed right-4 glass rounded-xl transition-all duration-500 ease-out overflow-hidden ${
          isOpen 
            ? 'bottom-[152px] opacity-100 translate-y-0 z-40' 
            : 'bottom-[20px] opacity-0 translate-y-[calc(100%+10px)] pointer-events-none z-40'
        }`}
        style={{
          width: 'calc(20rem - 2rem)', // Match the sidebar width minus its padding (w-80 - 32px)
          transformOrigin: 'bottom',
          maxHeight: 'calc(100vh - 200px)'
        }}
      >
        <div className="flex flex-col h-[450px]">
          {/* Header - matches profile tile padding */}
          <div className="p-4 pb-0 border-b border-[#27272a]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#e4e4e7]">Friends</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#27272a] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
            </div>

            {/* Tabs - more compact */}
            <div className="flex gap-0">
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-all relative ${
                  activeTab === 'friends' 
                    ? 'text-[#e4e4e7]' 
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Friends ({friends.length})
                {activeTab === 'friends' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-all relative flex items-center justify-center gap-1 ${
                  activeTab === 'pending' 
                    ? 'text-[#e4e4e7]' 
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Pending
                {pendingRequests.length > 0 && (
                  <span className="bg-[#ef4444] text-white text-[9px] rounded-full px-1 min-w-[14px] text-center">
                    {pendingRequests.length}
                  </span>
                )}
                {activeTab === 'pending' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('add')}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-all relative ${
                  activeTab === 'add' 
                    ? 'text-[#e4e4e7]' 
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Add
                {activeTab === 'add' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
                )}
              </button>
            </div>
          </div>

          {/* Content - matches profile tile padding */}
          <div className="flex-1 p-4 overflow-hidden">
            {activeTab === 'friends' ? (
              <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] scrollbar-track-transparent">
                {isLoading ? (
                  <div className="text-center py-8">
                    <p className="text-[#71717a] text-sm">Loading friends...</p>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-3">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="#71717a">
                        <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z"/>
                        <path d="M20.0001 10.0001V7.00006H18.0001V10.0001H15.0001V12.0001H18.0001V15.0001H20.0001V12.0001H23.0001V10.0001H20.0001Z"/>
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-[#e4e4e7] mb-1">No friends yet</h3>
                    <p className="text-[#71717a] text-xs mb-3">
                      Start by adding some friends!
                    </p>
                    <button
                      onClick={() => setActiveTab('add')}
                      className="btn btn-primary px-3 py-1.5 text-xs"
                    >
                      Add Friends
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {friends.map((friend, index) => (
                      <div 
                        key={friend.friendId || friend.userId || `friend-${index}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-[#18181b] transition-all group"
                      >
                        <div 
                          className="flex items-center gap-2 flex-1 cursor-pointer"
                          onClick={() => setShowUserProfile(friend.friendId)}
                        >
                          <div className="relative">
                            {friend.photoURL ? (
                              <Image
                                src={friend.photoURL}
                                alt={friend.displayName || 'User'}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-xs font-semibold">
                                {friend.displayName?.[0] || friend.username?.[0] || '?'}
                              </div>
                            )}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${getStatusColor(friend.status)} rounded-full border-2 border-[#18181b]`} />
                          </div>
                          <div>
                            <p className="text-xs text-[#e4e4e7] font-medium">{friend.displayName}</p>
                            <p className="text-[10px] text-[#71717a]">@{friend.username}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartChat(friend.friendId)}
                            className="p-1.5 rounded hover:bg-[#27272a] transition-colors text-[#71717a] hover:text-[#818cf8]"
                            title="Start Chat"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M4.79805 3C3.80445 3 2.99805 3.8055 2.99805 4.8V15.6C2.99805 16.5936 3.80445 17.4 4.79805 17.4H7.49805V21L11.098 17.4H19.198C20.1925 17.4 20.998 16.5936 20.998 15.6V4.8C20.998 3.8055 20.1925 3 19.198 3H4.79805Z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRemoveFriend(friend.friendId)}
                            className="p-1.5 rounded hover:bg-[#27272a] transition-colors text-[#71717a] hover:text-[#ef4444] opacity-0 group-hover:opacity-100"
                            title="Remove Friend"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
              <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] scrollbar-track-transparent">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-3">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="#71717a">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-[#e4e4e7] mb-1">No pending requests</h3>
                    <p className="text-[#71717a] text-xs">
                      Friend requests will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[#71717a] mb-2">
                      {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}
                    </p>
                    {pendingRequests.map((request, index) => {
                      const isSentRequest = request.fromUserId === user?.uid;
                      const displayUserId = isSentRequest ? request.toUserId : request.fromUserId;
                      const cachedProfile = displayUserId ? profileCache[displayUserId] : null;
                      const displayName =
                        (isSentRequest ? request.toDisplayName : request.fromDisplayName) ||
                        cachedProfile?.displayName ||
                        'Unknown User';
                      const avatarUrl = isSentRequest
                        ? request.toPhotoURL || cachedProfile?.photoURL
                        : request.fromPhotoURL || cachedProfile?.photoURL;

                      return (
                        <div
                          key={request.id || request.requestId || `pending-${index}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#18181b] border border-[#27272a]"
                        >
                          <div 
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => setShowUserProfile(displayUserId)}
                          >
                            {avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt={displayName || 'User'}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-xs font-semibold">
                                {displayName?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-[#e4e4e7] font-medium">{displayName}</p>
                              <p className="text-[10px] text-[#71717a]">
                                {isSentRequest ? 'Request sent' : 'Wants to be your friend'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {isSentRequest ? (
                              <button
                                onClick={() => handleRejectRequest(request.id || request.requestId)}
                                className="px-2 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-[10px] rounded transition-colors"
                              >
                                Cancel
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleAcceptRequest(request)}
                                  className="px-2 py-1 bg-[#22c55e] hover:bg-[#16a34a] text-white text-[10px] rounded transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(request.id || request.requestId)}
                                  className="px-2 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-[10px] rounded transition-colors"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Add Friend Tab
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#a1a1aa] mb-1 block">Search by name or username</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search for friends..."
                    className="input w-full text-sm"
                    autoFocus
                  />
                  <p className="text-[10px] text-[#71717a] mt-1">
                    Enter at least 2 characters to search
                  </p>
                </div>

                {isSearching && (
                  <div className="text-center py-6">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#818cf8]"></div>
                    <p className="text-xs text-[#71717a] mt-2">Searching...</p>
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-1 max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] scrollbar-track-transparent">
                    <p className="text-[10px] text-[#71717a] mb-1">
                      Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
                    </p>
                    {searchResults.map((result, index) => {
                      const resolvedUserId = result.userId || result.id;
                      const cachedProfile = resolvedUserId ? profileCache[resolvedUserId] : null;
                      const displayName = result.displayName || cachedProfile?.displayName || result.username;
                      const avatarUrl = result.photoURL || cachedProfile?.photoURL;
                      return (
                        <div
                          key={resolvedUserId || `search-${index}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#18181b] hover:bg-[#27272a] transition-colors"
                        >
                          <div 
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => resolvedUserId && setShowUserProfile(resolvedUserId)}
                          >
                            {avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt={displayName}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-xs font-semibold">
                                {displayName?.[0] || result.username?.[0] || '?'}
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-[#e4e4e7] font-medium">{displayName}</p>
                              <p className="text-[10px] text-[#71717a]">@{result.username}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSendFriendRequest(result)}
                            className="px-2 py-1 bg-[#818cf8] hover:bg-[#6366f1] text-white text-[10px] rounded transition-colors"
                          >
                            Add Friend
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isSearching && searchTerm.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-xs text-[#71717a]">No users found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Profile Card */}
      {showUserProfile && (
        <UserProfileCard
          userId={showUserProfile}
          isOpen={!!showUserProfile}
          onClose={() => setShowUserProfile(null)}
          onStartChat={(conversationId) => {
            if (onStartChat) {
              onStartChat(conversationId);
            }
            setShowUserProfile(null);
            onClose();
          }}
        />
      )}
    </>
  );
};

export default FriendsPanel;
