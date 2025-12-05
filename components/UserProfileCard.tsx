"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { userService } from '@/lib/aws/dynamodb-client';
import { getFriendStatus, sendFriendRequest, removeFriend, acceptFriendRequest, getPendingRequests } from '@/lib/friendService';
import { createOrGetDMConversation } from '@/lib/conversationService';
import { useAuth } from '@/hooks/useAuth';

interface UserProfileCardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onStartChat?: (conversationId: string) => void;
}

interface UserProfile {
  uid: string;
  displayName?: string;
  username?: string;
  bio?: string;
  photoURL?: string;
  createdAt?: any;
}

type FriendStatus = 'none' | 'friends' | 'pending_sent' | 'pending_received';

const UserProfileCard: React.FC<UserProfileCardProps> = ({
  userId,
  isOpen,
  onClose,
  onStartChat
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile();
      checkFriendStatus();
      
      // Poll for profile updates every 2 seconds while card is open
      const pollInterval = setInterval(() => {
        loadUserProfile();
      }, 2000);
      
      return () => clearInterval(pollInterval);
    }
  }, [isOpen, userId]);

  const loadUserProfile = async () => {
    setError(''); // Clear any previous errors
    console.log('Loading profile for userId:', userId);
    
    try {
      const userProfile = await userService.getUser(userId);
      console.log('User profile response:', userProfile);
      
      if (userProfile) {
        setProfile({
          uid: userProfile.userId || userProfile.uid,
          displayName: userProfile.displayName || 'Unknown User',
          username: userProfile.username || 'unknown',
          bio: userProfile.bio,
          photoURL: userProfile.photoURL,
          createdAt: userProfile.createdAt || userProfile.updatedAt
        });
      } else {
        console.warn('User profile not found for userId:', userId);
        setError('User profile not found');
      }
    } catch (err: any) {
      console.error('Error loading user profile:', err);
      console.error('Error details:', { userId, error: err.message });
      
      // More specific error messages
      if (err.message?.includes('permissions') || err.message?.includes('unauthorized')) {
        setError('You do not have permission to view this profile');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Network error. Please check your connection.');
      } else {
        setError('Unable to load profile. Please try again.');
      }
    }
  };

  const checkFriendStatus = async () => {
    if (!user?.uid || user.uid === userId) return;
    
    try {
      const status = await getFriendStatus(user.uid, userId);
      setFriendStatus(status);
    } catch (err) {
      console.error('Error checking friend status:', err);
    }
  };

  const handleAddFriend = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError('');
    try {
      await sendFriendRequest(user.uid, userId);
      setFriendStatus('pending_sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptFriend = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError('');
    try {
      // Get pending requests to find the request ID
      const requests = await getPendingRequests(user.uid);
      const request = requests.find(r => r.fromUserId === userId);
      if (!request || !request.id) {
        throw new Error('Friend request not found');
      }
      await acceptFriendRequest(request.id);
      setFriendStatus('friends');
    } catch (err: any) {
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError('');
    try {
      await removeFriend(user.uid, userId);
      setFriendStatus('none');
    } catch (err: any) {
      setError(err.message || 'Failed to remove friend');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError('');
    try {
      const conversationId = await createOrGetDMConversation(user.uid, userId);
      if (onStartChat) {
        onStartChat(conversationId);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start chat');
    } finally {
      setLoading(false);
    }
  };

  const formatJoinDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    
    let date: Date;
    // Handle DynamoDB numeric timestamp (milliseconds since epoch)
    if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Firebase Timestamp
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      // Firebase Timestamp with seconds
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (!isOpen || !profile) return null;

  const isOwnProfile = user?.uid === userId;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-dark rounded-xl p-6 w-full max-w-md animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#e4e4e7]">{isOwnProfile ? 'My Profile' : 'User Profile'}</h2>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-[#ef4444] bg-[#ef4444]/10 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Profile Content */}
        <div className="space-y-4">
          {/* Profile Picture and Name */}
          <div className="flex items-center gap-4">
            {profile.photoURL ? (
              <Image
                src={profile.photoURL}
                alt={profile.displayName || 'User'}
                width={80}
                height={80}
                className="rounded-full"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-2xl font-bold">
                {profile.displayName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold text-[#e4e4e7]">
                {profile.displayName || 'Unknown User'}
              </h3>
              <p className="text-sm text-[#71717a]">@{profile.username || 'unknown'}</p>
            </div>
          </div>

          {/* Bio - only show if exists, no box or label */}
          {profile.bio && (
            <p className="text-sm text-[#a1a1aa] italic">
              {profile.bio}
            </p>
          )}

          {/* Join Date */}
          <div>
            <p className="text-sm text-[#a1a1aa] mb-1">Member Since</p>
            <p className="text-sm text-[#e4e4e7]">
              {formatJoinDate(profile.createdAt)}
            </p>
          </div>

          {/* Action Buttons */}
          {isOwnProfile ? (
            <div className="pt-4 border-t border-[#27272a]">
              <div className="text-center py-3">
                <span className="text-sm text-[#71717a] italic">This is your profile</span>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-[#27272a] space-y-2">
              {/* Start Chat Button */}
              <button
                onClick={handleStartChat}
                disabled={loading}
                className="w-full px-4 py-2 bg-[#818cf8] hover:bg-[#6366f1] text-white rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
                Start Chat
              </button>

              {/* Friend Actions */}
              {friendStatus === 'none' && (
                <button
                  onClick={handleAddFriend}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-[#27272a] hover:bg-[#18181b] text-[#e4e4e7] rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Add Friend
                </button>
              )}

              {friendStatus === 'pending_sent' && (
                <button
                  disabled
                  className="w-full px-4 py-2 bg-[#27272a] text-[#71717a] rounded-lg cursor-not-allowed"
                >
                  Friend Request Sent
                </button>
              )}

              {friendStatus === 'pending_received' && (
                <button
                  onClick={handleAcceptFriend}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Accept Friend Request
                </button>
              )}

              {friendStatus === 'friends' && (
                <button
                  onClick={handleRemoveFriend}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  Remove Friend
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileCard;
