"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { 
  getUserConversations, 
  getConversationWithDetails, 
  sendMessage as sendConversationMessage, 
  createOrGetDMConversation, 
  createGroupChat,
  subscribeToConversationMessages,
  subscribeToUserConversations,
  hideConversation,
  renameGroupChat,
  leaveGroupChat,
  deleteGroupChat
} from '@/lib/aws/aws-conversation-service';
import { getFriends, getPendingRequests } from '@/lib/aws/aws-friend-service';
import { setTypingStatus, subscribeToTypingStatus, formatTypingMessage } from '@/lib/aws/typing-service';
import ProfileEditModal from '@/components/ProfileEditModal';
import GroupChatManageModal from '@/components/GroupChatManageModal';
import FriendsPanel from '@/components/FriendsPanel';
import SettingsPanel from '@/components/SettingsPanel';
import UserProfileCard from '@/components/UserProfileCard';
import { useToast } from '@/components/Toast';


interface DMConversation {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
}

interface GroupChat {
  id: string;
  name: string;
  members: number;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}


interface Friend {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
}

interface Message {
  id: string;
  text: string;
  createdAt: {
    toDate?: () => Date;
    seconds?: number;
    nanoseconds?: number;
  };
  uid: string;
  displayName: string;
  photoURL?: string;
}

const ChatDashboard: React.FC = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const { showToast } = useToast();
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, { displayName?: string; username?: string; photoURL?: string }>>({});
  const [conversations, setConversations] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [conversationFilter, setConversationFilter] = useState<'all' | 'dm' | 'group'>('all');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [showGroupManageModal, setShowGroupManageModal] = useState(false);
  const [managedGroup, setManagedGroup] = useState<{ id: string; name: string; createdBy: string; participants: number; participantIds?: string[] } | null>(null);
  const [showUserProfile, setShowUserProfile] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const userProfileUnsubsRef = useRef<Map<string, () => void>>(new Map());
  const isInitialLoad = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const justSentMessage = useRef(false);


  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-[#22c55e]';
      case 'idle': return 'bg-[#eab308]';
      case 'dnd': return 'bg-[#ef4444]';
      default: return 'bg-[#71717a]';
    }
  };

  const displayName = profile?.displayName || user?.displayName || 'User';

  // Subscribe to user's conversations with real-time updates
  useEffect(() => {
    if (!user?.uid) return;

    // Subscribe to real-time conversation updates
    const unsubscribe = subscribeToUserConversations(user.uid, async (convos) => {
      try {
        // Filter conversations based on selected filter
        let filteredConvos = convos;
        if (conversationFilter !== 'all') {
          filteredConvos = convos.filter(c => c.type === conversationFilter);
        }
        
        // Don't filter out hidden conversations here - we'll handle visibility in the UI
        // This ensures we can see when new messages arrive in hidden conversations
        
        // Get details for each conversation
        const convosWithDetails = await Promise.all(
          filteredConvos.map(async (convo) => {
            try {
              const details = await getConversationWithDetails(convo.id);
              return details;
            } catch (error) {
              console.warn('Error fetching details for conversation:', convo.id, error);
              return convo; // Return basic conversation if details fail
            }
          })
        );
        
        // Sort conversations by last message timestamp or updatedAt (most recent first)
        const sortedConvos = convosWithDetails
          .filter(c => c !== null)
          .sort((a, b) => {
            // Get timestamp from lastMessage or updatedAt
            const aTime = a.lastMessage?.timestamp?.seconds || 
                         a.updatedAt?.seconds || 0;
            const bTime = b.lastMessage?.timestamp?.seconds || 
                         b.updatedAt?.seconds || 0;
            return bTime - aTime; // Descending order (newest first)
          });
          
        setConversations(sortedConvos);
      } catch (error) {
        console.error('Error processing conversations:', error);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, conversationFilter]);


  // Load user's friends and pending requests count
  useEffect(() => {
    if (!user?.uid) return;

    const loadFriendsData = async () => {
      try {
        // Load friends
        const userFriends = await getFriends(user.uid);
        setFriends(userFriends);
        
        // Load pending requests count
        const requests = await getPendingRequests(user.uid);
        const incomingRequests = requests.filter(req => req.toUserId === user.uid);
        setPendingRequestsCount(incomingRequests.length);
      } catch (error) {
        console.error('Error loading friends data:', error);
      }
    };

    loadFriendsData();
    
    // Refresh every 5 seconds to check for new requests
    const interval = setInterval(loadFriendsData, 5000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!selectedConversation || !user?.uid) return;

    const unsubscribe = subscribeToTypingStatus(
      selectedConversation,
      user.uid,
      (users) => {
        setTypingUsers(users);
      }
    );

    return () => {
      unsubscribe();
      // Clear typing status when leaving conversation
      setTypingStatus(selectedConversation, user.uid, user.displayName || '', false).catch(() => {
        // Ignore errors when clearing typing status
      });
    };
  }, [selectedConversation, user]);

  // Save scroll position when switching conversations
  useEffect(() => {
    return () => {
      // Save current scroll position when unmounting
      if (selectedConversation && messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        const scrollTop = container.scrollTop;
        scrollPositions.current.set(selectedConversation, scrollTop);
      }
    };
  }, [selectedConversation]);

  // Load messages for selected conversation
  useEffect(() => {
    if (selectedConversation) {
      // Load conversation messages
      isInitialLoad.current = true;
      
      const unsubscribe = subscribeToConversationMessages(selectedConversation, (convMessages) => {
        const formattedMessages: Message[] = convMessages.map(msg => ({
          id: msg.id,
          text: msg.text,
          createdAt: msg.timestamp as any,
          uid: msg.senderId,
          displayName: '',
          photoURL: ''
        }));
        
        setMessages(formattedMessages);
        
        // Only scroll on initial load or when user just sent a message
        if (isInitialLoad.current) {
          setTimeout(() => {
            const savedPosition = scrollPositions.current.get(selectedConversation);
            if (savedPosition !== undefined && messagesContainerRef.current) {
              // Restore previous scroll position
              messagesContainerRef.current.scrollTop = savedPosition;
            } else {
              // First time in conversation, scroll to bottom
              messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
            }
            isInitialLoad.current = false;
          }, 100);
        } else if (justSentMessage.current) {
          // Scroll to bottom only for user's own sent messages
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            justSentMessage.current = false;
          }, 100);
        }
        // Otherwise, no auto-scroll - user has full control
      });
      
      return unsubscribe;
    }
  }, [selectedConversation]);

  // Track user profiles
  useEffect(() => {
    const uids = new Set<string>();
    messages.forEach(m => uids.add(m.uid));
    if (user?.uid) uids.add(user.uid);

    // Fetch user profiles from DynamoDB
    const fetchUserProfiles = async () => {
      const { userService } = await import('@/lib/aws/dynamodb-client');
      
      for (const uid of uids) {
        if (!userProfileUnsubsRef.current.has(uid)) {
          try {
            const userData = await userService.getUser(uid);
            if (userData) {
              setUserProfiles(prev => ({
                ...prev,
                [uid]: {
                  displayName: userData.displayName,
                  username: userData.username,
                  photoURL: userData.photoURL,
                }
              }));
            }
          } catch (error) {
            console.error(`Error fetching user profile for ${uid}:`, error);
          }
          // Mark as fetched to avoid repeated calls
          userProfileUnsubsRef.current.set(uid, () => {});
        }
      }
    };

    fetchUserProfiles();

    // Clean up profiles no longer needed
    Array.from(userProfileUnsubsRef.current.keys()).forEach(uid => {
      if (!uids.has(uid)) {
        userProfileUnsubsRef.current.delete(uid);
        setUserProfiles(prev => {
          const { [uid]: _removed, ...rest } = prev;
          return rest;
        });
      }
    });
  }, [messages, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage;
    setNewMessage("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);

    try {
      if (selectedConversation) {
        // Send to conversation (DM or group chat)
        await sendConversationMessage(selectedConversation, user.uid, messageText);
      }

      // Mark that user just sent a message (will trigger scroll in message listener)
      justSentMessage.current = true;
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
    }
  };

  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Handle typing indicators for conversations
    if (selectedConversation && user) {
      if (!isTyping && e.target.value.trim()) {
        setIsTyping(true);
        // Set typing status in database
        await setTypingStatus(selectedConversation, user.uid, user.displayName || 'User', true).catch(() => {
          // Ignore errors
        });
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(async () => {
        setIsTyping(false);
        // Clear typing status in database
        if (selectedConversation) {
          await setTypingStatus(selectedConversation, user.uid, user.displayName || 'User', false).catch(() => {
            // Ignore errors
          });
        }
      }, 2000);
    }
  };

  // Removed user search - now handled in FriendsPanel

  const handleCreateConversation = async () => {
    if (!user?.uid) return;

    try {
      if (selectedUsers.length === 0) return;
      
      let conversationId: string;
      
      if (selectedUsers.length === 1) {
        // Create DM
        conversationId = await createOrGetDMConversation(user.uid, selectedUsers[0].id);
      } else {
        // Create group chat
        if (!groupName.trim()) {
          showToast('Please enter a group name', 'warning');
          return;
        }
        const participantIds = selectedUsers.map(u => u.id);
        conversationId = await createGroupChat(user.uid, participantIds, groupName);
      }
      
      // Set the new conversation as selected
      setSelectedConversation(conversationId);
      
      // Reset modal first
      setShowNewConversationModal(false);
      setSelectedUsers([]);
      setGroupName('');
      
      // Refresh conversations with error handling for individual conversation details
      try {
        const convos = await getUserConversations(user.uid, conversationFilter);
        const convosWithDetails = await Promise.all(
          convos.map(async (convo) => {
            try {
              const details = await getConversationWithDetails(convo.id);
              return details;
            } catch (error) {
              console.warn('Error fetching details for conversation:', convo.id, error);
              // Return the basic conversation without participant details
              return convo;
            }
          })
        );
        setConversations(convosWithDetails.filter(c => c !== null));
      } catch (error) {
        console.error('Error refreshing conversations list:', error);
        // Don't show an error - the conversation was created successfully
        // It will appear on next manual refresh
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      // Only show error if the actual creation failed
      if (error instanceof Error && error.message) {
        showToast(`Failed to create conversation: ${error.message}`, 'error');
      } else {
        showToast('Failed to create conversation', 'error');
      }
    }
  };

  // Removed server and channel management functions - no longer needed

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return "";
    
    let date: Date;
    
    // Handle different timestamp formats
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'number') {
      // Handle millisecond timestamp from DynamoDB
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } else if (isYesterday) {
      return `Yesterday at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
    }
    return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  };

  return (
    <div className="h-screen bg-[#0a0a0b] overflow-hidden flex">
      {/* Left Sidebar with two tiles (narrower) */}
      <div className="w-64 flex flex-col gap-4 p-4">
        
        {/* Direct Messages Tile */}
        <div className="flex-1 glass rounded-xl p-3 flex flex-col animate-fade-in-up">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[#e4e4e7] flex items-center gap-2">
              <span>💬</span>
              Messages
            </h2>
            {(() => {
              const unreadCount = conversations.filter(c => 
                c.lastMessage && 
                c.lastMessage.senderId !== user?.uid &&
                !c.hiddenBy?.includes(user?.uid || '')
              ).length;
              return unreadCount > 0 ? (
                <span className="text-xs bg-[#ef4444]/20 text-[#ef4444] px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              ) : null;
            })()}
          </div>
          
          {/* Filter Dropdown */}
          <div className="mb-3">
            <select
              value={conversationFilter}
              onChange={(e) => setConversationFilter(e.target.value as 'all' | 'dm' | 'group')}
              className="w-full px-3 py-1.5 text-xs 
                bg-black/40 backdrop-blur-md 
                text-[#e4e4e7] 
                rounded-lg 
                border border-white/10 
                focus:border-[#818cf8]/50 focus:ring-1 focus:ring-[#818cf8]/30 
                outline-none 
                transition-all duration-200
                hover:bg-white/5
                cursor-pointer
                appearance-none
                bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDEuNUw2IDYuNUwxMSAxLjUiIHN0cm9rZT0iI2ExYTFhYSIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4=')] 
                bg-no-repeat 
                bg-[position:right_0.5rem_center] 
                pr-8"
              style={{
                backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDEuNUw2IDYuNUwxMSAxLjUiIHN0cm9rZT0iI2ExYTFhYSIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4=')`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="all" className="bg-[#0a0a0b] text-[#e4e4e7]">All Messages</option>
              <option value="dm" className="bg-[#0a0a0b] text-[#e4e4e7]">Direct Messages</option>
              <option value="group" className="bg-[#0a0a0b] text-[#e4e4e7]">Group Chats</option>
            </select>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {conversations.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-[#71717a]">No conversations yet</p>
                <p className="text-xs text-[#71717a] mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              <>
                {conversations
                  .filter(convo => !convo.hiddenBy?.includes(user?.uid || '')) // Filter hidden conversations
                  .filter(convo => convo.type === 'dm' || conversationFilter !== 'dm')
                  .filter(convo => convo.type === 'group' || conversationFilter !== 'group')
                  .map(convo => {
                    const otherParticipant = convo.type === 'dm' 
                      ? convo.participantDetails?.find((p: any) => p.id !== user?.uid)
                      : null;
                    const displayName = convo.type === 'dm' 
                      ? otherParticipant?.displayName || 'Unknown User'
                      : convo.name || 'Unnamed Group';
                    const isUnread = convo.lastMessage && convo.lastMessage.senderId !== user?.uid;
                    
                    return (
                      <div
                        key={convo.id}
                        onClick={() => {
                          setSelectedConversation(convo.id);
                        }}
                        className={`group relative w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
                          selectedConversation === convo.id 
                            ? 'bg-[#818cf8]/20 border border-[#818cf8]/30' 
                            : 'hover:bg-[#18181b]'
                        }`}
                      >
                        {/* Profile Picture */}
                        <div className="relative flex-shrink-0">
                          {convo.type === 'group' ? (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#a78bfa] to-[#c084fc] flex items-center justify-center">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z"/>
                              </svg>
                            </div>
          ) : otherParticipant?.photoURL ? (
            <Image
              src={otherParticipant.photoURL}
              alt={otherParticipant.displayName}
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-xs font-semibold">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
                          {convo.type === 'dm' && otherParticipant?.status && (
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${getStatusColor(otherParticipant.status)} rounded-full border border-[#0a0a0b]`}></div>
                          )}
                        </div>
                        
                        {/* Name and last message */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm truncate ${isUnread ? 'text-[#e4e4e7] font-semibold' : 'text-[#a1a1aa]'}`}>
                              {displayName}
                            </span>
                            {convo.type === 'group' && (
                              <span className="text-xs text-[#71717a]">
                                ({convo.participants?.length || 0})
                              </span>
                            )}
                            {isUnread && (
                              <div className="w-2 h-2 bg-[#ef4444] rounded-full ml-auto"></div>
                            )}
                          </div>
                          <p className="text-xs text-[#71717a] truncate mt-0.5">
                            {convo.lastMessage?.text || 'No messages yet'}
                          </p>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex items-center gap-1">
                          {convo.type === 'group' && (
                            // Manage button for groups
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setManagedGroup({
                                  id: convo.id,
                                  name: convo.name || 'Unnamed Group',
                                  createdBy: convo.createdBy,
                                  participants: convo.participants?.length || 0,
                                  participantIds: convo.participants || []
                                });
                                setShowGroupManageModal(true);
                              }}
                              className="p-1 hover:bg-[#27272a] rounded transition-colors"
                              title="Manage group"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#71717a">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                              </svg>
                            </button>
                          )}
                          {/* Hide button for both DMs and Groups */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await hideConversation(convo.id, user?.uid || '');
                                // Clear selection if hiding current conversation
                                if (selectedConversation === convo.id) {
                                  setSelectedConversation(null);
                                }
                              } catch (error) {
                                console.error('Error hiding conversation:', error);
                              }
                            }}
                            className="p-1 hover:bg-[#27272a] rounded transition-colors"
                            title="Hide conversation"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#71717a">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
          
          <button
            onClick={() => setShowNewConversationModal(true)}
            className="mt-4 w-full px-4 py-2 bg-[#27272a] hover:bg-[#18181b] text-[#e4e4e7] rounded-lg transition-all flex items-center justify-center gap-2 text-xs">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H13V4H11V11H4V13H11V20H13V13H20V11Z"/>
            </svg>
            New Chat
          </button>
        </div>


      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Main Chat Tile */}
        <div className="flex-1 glass rounded-xl flex flex-col overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          {/* Header for conversations */}
          <div className="px-6 py-4 border-b border-[#27272a]">
            {selectedConversation ? (
              // Conversation Header (DM or Group)
              (() => {
                const conversation = conversations.find(c => c.id === selectedConversation);
                const isDM = conversation?.type === 'dm';
                const otherParticipant = isDM ? conversation?.participantDetails?.find((p: any) => p.id !== user?.uid) : null;
                
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isDM && otherParticipant ? (
                        // DM Header
                        <>
                          {otherParticipant.photoURL ? (
                            <Image
                              src={otherParticipant.photoURL}
                              alt={otherParticipant.displayName}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white font-semibold">
                              {otherParticipant.displayName?.[0] || '?'}
                            </div>
                          )}
                          <div>
                            <h1 className="text-xl font-bold text-[#e4e4e7]">{otherParticipant.displayName}</h1>
                            <p className="text-xs text-[#71717a]">@{otherParticipant.username}</p>
                          </div>
                        </>
                      ) : (
                        // Group Chat Header
                        <>
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white font-semibold">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          </div>
                          <div>
                            <h1 className="text-xl font-bold text-[#e4e4e7]">{conversation?.name || 'Group Chat'}</h1>
                            <p className="text-xs text-[#71717a]">{conversation?.participants?.length || 0} members</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Additional conversation actions can go here */}
                    </div>
                  </div>
                );
              })()
            ) : (
              // No conversation selected
              <h1 className="text-xl font-bold text-[#e4e4e7]">
                Select a conversation
              </h1>
            )}
          </div>

          {/* Chat/Content Area */}
            <div className="flex-1 flex flex-col">
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center bg-[#0a0a0b]/50">
                <div className="text-center p-8">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#818cf8]/20 to-[#c084fc]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <span className="text-4xl">💬</span>
                  </div>
                  <h3 className="text-2xl font-bold text-[#e4e4e7] mb-3">
                    No conversation selected
                  </h3>
                  <p className="text-[#a1a1aa] text-sm">
                    Select a conversation from the left sidebar to start chatting
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Conversation Header */}
                {selectedConversation ? (
                  // Conversation sub-header (smaller than main header)
                  (() => {
                    const conversation = conversations.find(c => c.id === selectedConversation);
                    const isDM = conversation?.type === 'dm';
                    const otherParticipant = isDM ? conversation?.participantDetails?.find((p: any) => p.id !== user?.uid) : null;
                    
                    return (
                      <div className="border-b border-[#27272a] px-4 py-3 flex items-center justify-between bg-[#18181b]/20">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#71717a]">
                            {isDM ? 'Direct Message' : `Group Chat • ${conversation?.participants?.length || 0} members`}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : null}

                {/* Messages Area */}
                <div className="flex-1 relative">
                  <div 
                    ref={messagesContainerRef}
                    className="absolute inset-0 overflow-y-auto p-4"
                    onScroll={(e) => {
                      const container = e.currentTarget;
                      const scrollTop = container.scrollTop;
                      const scrollHeight = container.scrollHeight;
                      const clientHeight = container.clientHeight;
                      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
                      
                      // Show button when scrolled up more than 200px from bottom
                      setShowScrollButton(distanceFromBottom > 200);
                    }}
                  >
                    {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-4">
                              <span className="text-3xl text-[#71717a]">💬</span>
                            </div>
                            <h3 className="text-xl font-semibold text-[#e4e4e7] mb-2">
                              {(() => {
                                const conversation = conversations.find(c => c.id === selectedConversation);
                                if (conversation?.type === 'dm') {
                                  const otherParticipant = conversation.participantDetails?.find((p: any) => p.id !== user?.uid);
                                  return `This is the beginning of your conversation with ${otherParticipant?.displayName || 'this user'}`;
                                } else {
                                  return `Welcome to ${conversation?.name || 'this group chat'}!`;
                                }
                              })()}
                            </h3>
                            <p className="text-[#71717a]">
                              Send a message to start the conversation.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {messages.map((msg, index) => {
                            // For conversations, get user info from participant details
                            let msgDisplayName = msg.displayName;
                            let photoURL = msg.photoURL;
                            
                            // Get user info from participant details or user profiles
                            const conversation = conversations.find(c => c.id === selectedConversation);
                            const participant = conversation?.participantDetails?.find((p: any) => p.id === msg.uid);
                            if (participant) {
                              msgDisplayName = participant.displayName || msgDisplayName;
                              photoURL = participant.photoURL || photoURL;
                            } else {
                              // Fallback to userProfiles cache
                              const profile = userProfiles[msg.uid];
                              msgDisplayName = profile?.displayName || msgDisplayName;
                              photoURL = profile?.photoURL || photoURL;
                            }
                            const isFirstInGroup = index === 0 || messages[index - 1].uid !== msg.uid;
                            
                            return (
                              <div
                                key={msg.id}
                                className={`group hover:bg-[#18181b]/50 px-4 py-1 rounded-lg transition-colors ${
                                  isFirstInGroup ? "mt-4" : ""
                                }`}
                              >
                                {isFirstInGroup ? (
                                  <div className="flex gap-3">
                                    <div 
                                      className="flex-shrink-0 cursor-pointer"
                                      onClick={() => setShowUserProfile(msg.uid)}
                                    >
                                      {photoURL ? (
                                        <Image
                                          src={photoURL}
                                          alt={msgDisplayName}
                                          width={40}
                                          height={40}
                                          className="rounded-full hover:opacity-80 transition-opacity"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white font-semibold hover:opacity-80 transition-opacity">
                                          {msgDisplayName[0]?.toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-baseline gap-2">
                                        <span 
                                          className="font-semibold text-[#e4e4e7] hover:underline cursor-pointer"
                                          onClick={() => setShowUserProfile(msg.uid)}
                                        >
                                          {msgDisplayName}
                                        </span>
                                        <span className="text-xs text-[#71717a]">
                                          {formatMessageTime(msg.createdAt)}
                                        </span>
                                      </div>
                                      <p className="text-[#d4d4d8] mt-0.5 break-words">
                                        {msg.text}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-3">
                                    <div className="w-10 flex-shrink-0"></div>
                                    <p className="text-[#d4d4d8] break-words flex-1">
                                      {msg.text}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </>
                      )}
                  </div>
                  
                  {/* Scroll to Bottom Button - positioned relative to container */}
                  {showScrollButton && (
                    <div className="absolute bottom-6 right-6 z-10">
                      <button
                        onClick={() => {
                          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="w-10 h-10 bg-[#818cf8] hover:bg-[#6366f1] rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
                        title="Scroll to bottom"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M7 10l5 5 5-5H7z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                {selectedConversation && (
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-[#27272a] bg-[#18181b]/20">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={handleTyping}
                        placeholder={(() => {
                          const conversation = conversations.find(c => c.id === selectedConversation);
                          if (conversation?.type === 'dm') {
                            const otherParticipant = conversation.participantDetails?.find((p: any) => p.id !== user?.uid);
                            return `Message @${otherParticipant?.username || 'user'}`;
                          } else {
                            return `Message ${conversation?.name || 'group'}`;
                          }
                        })()}
                        className="input flex-1"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="btn btn-primary px-6"
                      >
                        Send
                      </button>
                    </div>
                    {typingUsers.length > 0 && (
                      <div className="mt-2 text-xs text-[#71717a] flex items-center gap-1">
                        <span>{formatTypingMessage(typingUsers)}</span>
                      </div>
                    )}
                  </form>
                )}
              </>
            )}
            </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 flex flex-col gap-4 p-4">
        {/* Member List */}
        <div className="flex-1 glass rounded-xl p-4 overflow-y-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-xs text-[#71717a] uppercase font-semibold mb-3">
            {selectedConversation ? (
              <>Participants — {conversations.find(c => c.id === selectedConversation)?.participants?.length || 0}</>
            ) : (
              <>Select a conversation</>
            )}
          </h3>
          <div className="space-y-2">
            {selectedConversation ? (
              // Show conversation participants
              conversations.find(c => c.id === selectedConversation)?.participantDetails?.map((participant: any, index: number) => (
                <div 
                  key={participant.id || participant.userId || `participant-${index}`} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#18181b] transition-all cursor-pointer"
                  onClick={() => setShowUserProfile(participant.id || participant.userId)}
                >
                  <div className="relative">
                    {participant.photoURL ? (
                      <Image
                        src={participant.photoURL}
                        alt={participant.displayName}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-xs font-semibold">
                        {participant.displayName?.[0] || participant.username?.[0] || '?'}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 ${getStatusColor(participant.status)} rounded-full border-2 border-[#18181b]`}></div>
                  </div>
                  <div>
                    <p className="text-sm text-[#a1a1aa]">{participant.displayName}</p>
                    <p className="text-xs text-[#71717a]">@{participant.username}</p>
                  </div>
                </div>
              ))
            ) : null}
          </div>
        </div>

        {/* Profile & Settings Tile - Bottom Right */}
        <div className="glass rounded-xl p-4 animate-fade-in-up relative z-50" style={{ animationDelay: '0.3s' }}>
          <div 
            className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-[#27272a] rounded-lg p-2 -m-2 transition-colors"
            onClick={() => user?.uid && setShowUserProfile(user.uid)}
          >
            {profile?.photoURL ? (
              <Image
                src={profile.photoURL}
                alt={displayName}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-sm font-bold">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm text-[#e4e4e7] font-semibold">{displayName}</p>
              <p className="text-xs text-[#71717a]">@{profile?.username || 'username'}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setShowFriendsPanel(!showFriendsPanel);
                setShowSettingsPanel(false);
              }}
              className={`flex-1 btn ${showFriendsPanel ? 'btn-primary' : 'btn-secondary'} py-1.5 text-xs relative`}
            >
              Friends
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[10px] rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => {
                setShowSettingsPanel(!showSettingsPanel);
                setShowFriendsPanel(false);
              }}
              className={`flex-1 btn ${showSettingsPanel ? 'btn-primary' : 'btn-secondary'} py-1.5 text-xs`}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* New Conversation Modal - Only for creating chats with friends */}
      {showNewConversationModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="glass-dark rounded-xl p-6 w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#e4e4e7]">Start New Chat</h2>
              <button
                onClick={() => {
                  setShowNewConversationModal(false);
                  setSelectedUsers([]);
                  setGroupName('');
                }}
                className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#a1a1aa] mb-2 block">Select friends to chat with</label>
                {friends.length === 0 ? (
                  <div className="text-center py-8 border border-[#27272a] rounded-lg">
                    <p className="text-[#71717a]">No friends available</p>
                    <p className="text-xs text-[#71717a] mt-1">Add friends first to start a chat</p>
                    <button
                      onClick={() => {
                        setShowNewConversationModal(false);
                        setShowFriendsPanel(true);
                      }}
                      className="mt-3 btn btn-primary px-4 py-1.5 text-sm"
                    >
                      Add Friends
                    </button>
                  </div>
                ) : (
                  <div className="border border-[#27272a] rounded-lg p-2 max-h-60 overflow-y-auto">
                    {friends.map((friend, index) => {
                      // Use friendId as the unique identifier, fallback to index if not available
                      const friendKey = friend.friendId || friend.userId || `friend-${index}`;
                      const friendUid = friend.friendId || friend.userId;
                      
                      return (
                        <div
                          key={friendKey}
                          className="w-full p-2 rounded-lg hover:bg-[#18181b] transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedUsers.some(u => u.id === friendUid)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers([...selectedUsers, {
                                    id: friendUid,
                                    displayName: friend.displayName,
                                    username: friend.username
                                  }]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(u => u.id !== friendUid));
                                }
                              }}
                              className="rounded border-[#3f3f46] bg-[#18181b] text-[#818cf8]"
                            />
                            {friend.photoURL ? (
                              <Image
                                src={friend.photoURL}
                                alt={friend.displayName || friend.username}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-xs font-semibold">
                                {friend.displayName?.[0]?.toUpperCase() || friend.username?.[0]?.toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-[#e4e4e7]">{friend.displayName}</p>
                              <p className="text-xs text-[#71717a]">@{friend.username}</p>
                            </div>
                          </div>
                          <div className={`w-2 h-2 ${getStatusColor(friend.status)} rounded-full`}></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div>
                  <p className="text-xs text-[#71717a] mb-2">Selected Users ({selectedUsers.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(user => (
                      <div key={user.id} className="bg-[#18181b] px-3 py-1 rounded-full flex items-center gap-2">
                        <span className="text-sm text-[#e4e4e7]">{user.displayName || user.username}</span>
                        <button
                          onClick={() => setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))}
                          className="text-[#71717a] hover:text-[#ef4444]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Group Name Input (for multiple users) */}
              {selectedUsers.length > 1 && (
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-2 block">Group Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name..."
                    className="input w-full"
                  />
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowNewConversationModal(false);
                  setSelectedUsers([]);
                  setGroupName('');
                }}
                className="btn btn-secondary px-4 py-2"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateConversation}
                disabled={selectedUsers.length === 0 || (selectedUsers.length > 1 && !groupName.trim())}
                className="btn btn-primary px-4 py-2"
              >
                {selectedUsers.length > 1 ? 'Create Group' : 'Start Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friends Panel */}
      <FriendsPanel
        isOpen={showFriendsPanel}
        onClose={async () => {
          setShowFriendsPanel(false);
          // Refresh pending requests count when panel closes
          if (user?.uid) {
            try {
              const requests = await getPendingRequests(user.uid);
              const incomingRequests = requests.filter(req => req.toUserId === user.uid);
              setPendingRequestsCount(incomingRequests.length);
            } catch (error) {
              console.error('Error refreshing pending requests:', error);
            }
          }
        }}
        onStartChat={async (conversationId) => {
          setSelectedConversation(conversationId);
          // Refresh conversations
          if (user?.uid) {
            const convos = await getUserConversations(user.uid, conversationFilter);
            const convosWithDetails = await Promise.all(
              convos.map(async (convo) => {
                try {
                  const details = await getConversationWithDetails(convo.id);
                  return details;
                } catch (error) {
                  console.warn('Error fetching details for conversation:', convo.id, error);
                  return convo;
                }
              })
            );
            setConversations(convosWithDetails.filter(c => c !== null));
          }
        }}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        onEditProfile={() => {
          setShowSettingsPanel(false);
          setShowProfileEditModal(true);
        }}
        onViewProfile={() => {
          if (user?.uid) {
            setShowUserProfile(user.uid);
            setShowSettingsPanel(false);
          }
        }}
      />

      {/* Server Creation Modal - REMOVED
      {showNewServerModal && (
        <CreateServerModalEnhanced
          isOpen={showNewServerModal}
          onClose={() => setShowNewServerModal(false)}
          onServerCreated={(serverId) => {
            handleServerCreated();
            // Optionally select the new server
            if (setSelectedServer) {
              setSelectedServer(serverId);
            }
          }}
        />
      )} */}

      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={showProfileEditModal}
        onClose={() => setShowProfileEditModal(false)}
      />

      {/* Group Chat Manage Modal */}
      {showGroupManageModal && managedGroup && (
        <GroupChatManageModal
          isOpen={showGroupManageModal}
          onClose={() => {
            setShowGroupManageModal(false);
            setManagedGroup(null);
          }}
          groupChat={managedGroup}
          currentUserId={user?.uid || ''}
          onRename={async (newName) => {
            await renameGroupChat(managedGroup.id, newName, user?.uid || '');
            // Refresh conversations
            const convos = await getUserConversations(user?.uid || '', conversationFilter);
            const convosWithDetails = await Promise.all(
              convos.map(async (c) => {
                const details = await getConversationWithDetails(c.id);
                return details;
              })
            );
            setConversations(convosWithDetails.filter(c => c !== null));
          }}
          onLeave={async () => {
            await leaveGroupChat(managedGroup.id, user?.uid || '');
            // Refresh conversations and clear selection
            const convos = await getUserConversations(user?.uid || '', conversationFilter);
            const convosWithDetails = await Promise.all(
              convos.map(async (c) => {
                const details = await getConversationWithDetails(c.id);
                return details;
              })
            );
            setConversations(convosWithDetails.filter(c => c !== null));
            if (selectedConversation === managedGroup.id) {
              setSelectedConversation(null);
            }
          }}
          onDelete={async () => {
            await deleteGroupChat(managedGroup.id, user?.uid || '');
            // Refresh conversations and clear selection
            const convos = await getUserConversations(user?.uid || '', conversationFilter);
            const convosWithDetails = await Promise.all(
              convos.map(async (c) => {
                const details = await getConversationWithDetails(c.id);
                return details;
              })
            );
            setConversations(convosWithDetails.filter(c => c !== null));
            if (selectedConversation === managedGroup.id) {
              setSelectedConversation(null);
            }
          }}
        />
      )}

      {/* Channel Creation Modal - REMOVED
      {showCreateChannelModal && selectedServer && (
        <CreateChannelModal
          isOpen={showCreateChannelModal}
          onClose={() => setShowCreateChannelModal(false)}
          serverId={selectedServer}
          onChannelCreated={async () => {
            // Reload channels after creation
            const updatedChannels = await getChannels(selectedServer);
            // Ensure all channels have a type, defaulting to 'text' if undefined
            const channelsWithType = updatedChannels.map(ch => ({
              ...ch,
              type: ch.type || 'text' as 'text' | 'voice'
            }));
            setChannels(channelsWithType);
            setShowCreateChannelModal(false);
          }}
        />
      )} */}

      {/* Channel Management Modal - REMOVED
      {showChannelManageModal && managedChannel && (
        <ChannelManageModal
          isOpen={showChannelManageModal}
          onClose={() => {
            setShowChannelManageModal(false);
            setManagedChannel(null);
          }}
          channel={managedChannel}
          onUpdate={handleUpdateChannel}
          onDelete={handleDeleteChannel}
        />
      )} */}

      {/* Server Management Modal - REMOVED
      {showServerManageModal && managedServer && (
        <>
          {console.log('Rendering ServerManageModal:', { showServerManageModal, managedServer, isOwner: user?.uid === managedServer.ownerId })}
          <ServerManageModal
            isOpen={showServerManageModal}
            onClose={() => {
              setShowServerManageModal(false);
              setManagedServer(null);
            }}
            server={{ ...managedServer, members: managedServer.members }}
            onUpdate={handleUpdateServer}
            onDelete={handleDeleteServer}
            onLeave={async () => {
              if (managedServer) {
                await leaveServer(managedServer.id, user?.uid || '');
                // Refresh servers list
                const userServers = await getUserServers(user?.uid || '');
                setServers(userServers);
                // Clear selection if leaving current server
                if (selectedServer === managedServer.id) {
                  setSelectedServer?.('');
                  setConversationType('conversation');
                  setSelectedChannel('');
                  setChannels([]);
                }
              }
            }}
            isOwner={user?.uid === managedServer.ownerId}
            currentUserId={user?.uid || ''}
          />
        </>
      )} */}

      {/* User Profile Card */}
      {showUserProfile && (
        <UserProfileCard
          userId={showUserProfile}
          isOpen={!!showUserProfile}
          onClose={() => setShowUserProfile(null)}
          onStartChat={async (conversationId) => {
            setSelectedConversation(conversationId);
            // Refresh conversations to include the new one
            if (user?.uid) {
              const convos = await getUserConversations(user.uid, conversationFilter);
              const convosWithDetails = await Promise.all(
                convos.map(async (convo) => {
                  try {
                    const details = await getConversationWithDetails(convo.id);
                    return details;
                  } catch (error) {
                    console.warn('Error fetching details for conversation:', convo.id, error);
                    return convo;
                  }
                })
              );
              setConversations(convosWithDetails.filter(c => c !== null));
            }
          }}
        />
      )}
    </div>
  );
};

export default ChatDashboard;
