"use client";

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { isUsernameAvailable } from '@/lib/userService';
import { sendFriendRequest, removeFriend, checkIfFriends } from '@/lib/friendService';
import { useAuth } from '@/hooks/useAuth';
import { updateUserProfileComplete } from '@/lib/profileService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    displayName: string;
    username?: string;
    photoURL?: string;
    bio?: string;
    joinDate?: string;
    isFriend?: boolean;
  };
  currentUserId?: string;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ 
  isOpen, 
  onClose, 
  user,
  currentUserId 
}) => {
  const { user: authUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedBio, setEditedBio] = useState(user.bio || '');
  const [editedUsername, setEditedUsername] = useState(user.username || '');
  const [editedDisplayName, setEditedDisplayName] = useState(user.displayName || '');
  const [displayUsername, setDisplayUsername] = useState(user.username || '');
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [displayBio, setDisplayBio] = useState(user.bio || '');
  const [displayPhotoURL, setDisplayPhotoURL] = useState(user.photoURL || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFriend, setIsFriend] = useState<boolean>(!!user.isFriend);
  const [requestSent, setRequestSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    setDisplayUsername(user.username || '');
    setDisplayName(user.displayName || '');
    setDisplayBio(user.bio || '');
    setDisplayPhotoURL(user.photoURL || '');
    setEditedUsername(user.username || '');
    setEditedDisplayName(user.displayName || '');
    setEditedBio(user.bio || '');
    setIsFriend(!!user.isFriend);
    setRequestSent(false);
    setUploadError(null);
  }, [user]);

  useEffect(() => {
    const checkFriend = async () => {
      try {
        if (currentUserId && user.id && currentUserId !== user.id) {
          const res = await checkIfFriends(currentUserId, user.id);
          setIsFriend(res);
        }
      } catch {
        // ignore
      }
    };
    checkFriend();
  }, [currentUserId, user.id]);

  if (!isOpen) return null;

  // Format join date
  const formatJoinDate = (date?: string) => {
    if (!date) return 'Recently';
    try {
      const joinDate = new Date(date);
      // Check if date is valid
      if (isNaN(joinDate.getTime())) {
        return 'Recently';
      }
      return joinDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  };

  // Truncate bio to 150 characters
  const truncateBio = (bio?: string) => {
    if (!bio) return "No bio available.";
    if (bio.length <= 150) return bio;
    return bio.substring(0, 150) + "...";
  };

  const isOwnProfile = currentUserId === user.id;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUserId) return;
    setSaving(true);
    setUsernameError(null);
    setUploadError(null);
    
    try {
      // Validate username if changed
      if (editedUsername && editedUsername !== displayUsername) {
        const usernameRegex = /^[a-z0-9_]{3,20}$/;
        if (!usernameRegex.test(editedUsername.toLowerCase())) {
          setUsernameError('Username must be 3-20 characters, lowercase letters, numbers, and underscores only');
          setSaving(false);
          return;
        }
        
        const available = await isUsernameAvailable(editedUsername.toLowerCase(), currentUserId);
        if (!available) {
          setUsernameError('Username is already taken');
          setSaving(false);
          return;
        }
      }

      // Use centralized profile update service
      try {
        let currentPhotoURL = displayPhotoURL;
        
        // Keep track of existing photoURL if no new file
        if (!selectedFile) {
          currentPhotoURL = user.photoURL || '';
        }
        
        await updateUserProfileComplete(
          currentUserId,
          {
            username: editedUsername.toLowerCase() || displayUsername,
            displayName: editedDisplayName || displayName,
            bio: editedBio || '',
            photoURL: currentPhotoURL
          },
          selectedFile || undefined
        );
        
        // Update local state if file was uploaded
        if (selectedFile) {
          setPreviewImage(null);
          setSelectedFile(null);
        }
      } catch (uploadErr: any) {
        console.error('Profile update failed:', uploadErr);
        setUploadError(uploadErr.message || 'Failed to update profile.');
        setSaving(false);
        return;
      }
      
      setDisplayUsername(editedUsername.toLowerCase() || displayUsername);
      setDisplayName(editedDisplayName || displayName);
      setDisplayBio(editedBio);
      setIsEditing(false);
    } catch (e: any) {
      console.error('Failed to save profile', e);
      setUsernameError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedBio(user.bio || '');
    setEditedUsername(user.username || '');
    setEditedDisplayName(user.displayName || '');
    setPreviewImage(null);
    setSelectedFile(null);
    setUsernameError(null);
    setUploadError(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal */}
        <div 
          className="bg-white dark:bg-[#313338] rounded-lg p-6 max-w-2xl w-full mx-4 relative animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"></path>
            </svg>
          </button>

          {/* Profile Content */}
          <div className="flex flex-col">
            {/* Top Section - Avatar and Info Side by Side */}
            <div className="flex gap-6 mb-6">
              {/* Avatar Section */}
              <div className="relative flex-shrink-0">
                <div className="relative">
                  {(previewImage || displayPhotoURL) ? (
                    <div className="relative w-32 h-32">
                      <Image
                        src={previewImage || displayPhotoURL || ''}
                        alt={user.displayName || 'Profile'}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-4xl font-bold">
                      {user.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  {/* Online status indicator */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 bg-[#3BA55C] rounded-full border-4 border-white dark:border-[#313338]"></div>
                  
                  {/* Edit overlay for own profile */}
                  {isOwnProfile && isEditing && (
                    <div 
                      className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                        <path d="M4 4H7L9 2H15L17 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4ZM12 17C14.76 17 17 14.76 17 12C17 9.24 14.76 7 12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17ZM12 9C13.65 9 15 10.35 15 12C15 13.65 13.65 15 12 15C10.35 15 9 13.65 9 12C9 10.35 10.35 9 12 9Z"></path>
                      </svg>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {uploadError && (
                  <p className="text-xs text-red-400 mt-2 text-center">{uploadError}</p>
                )}
              </div>

              {/* Info Section */}
              <div className="flex-1 min-w-0">
                {/* Nickname (Display Name) */}
                {isEditing && isOwnProfile ? (
                  <div className="mb-2">
                    <label className="text-xs text-gray-400 uppercase font-semibold block mb-1">Nickname</label>
                    <input
                      type="text"
                      value={editedDisplayName}
                      onChange={(e) => setEditedDisplayName(e.target.value)}
                      placeholder="Display name"
                      className="w-full text-lg font-bold bg-[#1E1F22] text-white px-2 py-1 rounded outline-none focus:ring-2 focus:ring-[#5865F2]"
                      maxLength={32}
                    />
                  </div>
                ) : (
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {displayName || 'Anonymous'}
                  </h2>
                )}

                {/* Username */}
                {isEditing && isOwnProfile ? (
                  <div className="mb-3">
                    <label className="text-xs text-gray-400 uppercase font-semibold block mb-1">Username</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                      <input
                        type="text"
                        value={editedUsername}
                        onChange={(e) => setEditedUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="username"
                        className="w-full pl-7 text-sm bg-[#1E1F22] text-gray-400 px-2 py-1 rounded outline-none focus:ring-2 focus:ring-[#5865F2]"
                        maxLength={20}
                      />
                    </div>
                    {usernameError && (
                      <p className="text-xs text-red-400 mt-1">{usernameError}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">3-20 characters, lowercase letters, numbers, underscores</p>
                  </div>
                ) : (
                  displayUsername && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      @{displayUsername}
                    </p>
                  )
                )}

                {/* Bio */}
                <div className="mb-3">
                  {isEditing && isOwnProfile ? (
                    <textarea
                      value={editedBio}
                      onChange={(e) => setEditedBio(e.target.value.substring(0, 150))}
                      placeholder="Tell us about yourself..."
                      className="w-full bg-[#1E1F22] text-gray-300 text-sm px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#5865F2] resize-none h-20"
                      maxLength={150}
                    />
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      {truncateBio(displayBio || "Software developer by day, music producer by night. I'm passionate about creating digital experiences that make a difference. When I'm not coding, you can find me exploring new coffee shops or hiking mountain trails.")}
                    </p>
                  )}
                  {((isEditing && editedBio.length === 150) || (!isEditing && displayBio && displayBio.length > 150)) && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                      Bio truncated at 150 characters
                    </p>
                  )}
                </div>

                {/* Join Date */}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Joined {formatJoinDate(user.joinDate)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row gap-3 w-full">
              {!isOwnProfile ? (
                <>
                  {/* Message Button */}
                  <button
                    onClick={() => {
                      // TODO: Implement direct message functionality
                      console.log('Opening DM with', user.displayName || 'user');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1b1e] hover:bg-[#2a2b2e] text-white rounded-lg transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4.79805 3C3.80445 3 2.99805 3.8055 2.99805 4.8V15.6C2.99805 16.5936 3.80445 17.4 4.79805 17.4H7.49805V21L11.098 17.4H19.198C20.1925 17.4 20.998 16.5936 20.998 15.6V4.8C20.998 3.8055 20.1925 3 19.198 3H4.79805Z"></path>
                    </svg>
                    <span className="font-medium">Message</span>
                  </button>

                  {/* Call Button */}
                  <button
                    onClick={() => {
                      // TODO: Implement call functionality
                      console.log('Calling', user.displayName || 'user');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-[#2b2d31] hover:bg-gray-300 dark:hover:bg-[#35373c] text-gray-900 dark:text-white rounded-lg transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11 5L6 9H2V15H6L11 19V5ZM15.54 8.46C15.54 8.46 16.5 9.42 16.5 11.5C16.5 13.58 15.54 14.54 15.54 14.54L16.95 15.95C16.95 15.95 18.5 14.4 18.5 11.5C18.5 8.6 16.95 7.05 16.95 7.05L15.54 8.46ZM13.5 10.5V13.5L19 8L13.5 10.5Z"></path>
                    </svg>
                    <span className="font-medium">Call</span>
                  </button>

                  {/* Add/Remove Friend Button */}
                  <button
                    onClick={async () => {
                      if (!currentUserId || currentUserId === user.id) return;
                      try {
                        if (isFriend) {
                          await removeFriend(currentUserId, user.id);
                          setIsFriend(false);
                        } else {
                          if (authUser) {
                            await sendFriendRequest(currentUserId, authUser.displayName || 'Someone', user.id, user.displayName || 'Unknown');
                            setRequestSent(true);
                          }
                        }
                      } catch (e) {
                        console.error('Friend action failed', e);
                      }
                    }}
                    disabled={!isFriend && requestSent}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                      isFriend 
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : requestSent
                          ? 'bg-gray-500 text-white cursor-not-allowed'
                          : 'bg-[#5865F2] hover:bg-[#4752C4] text-white'
                    }`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      {isFriend ? (
                        // Remove friend icon
                        <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006ZM17 11V13H23V11H17Z"></path>
                      ) : (
                        // Add friend icon
                        <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006ZM20 11V8H18V11H15V13H18V16H20V13H23V11H20Z"></path>
                      )}
                    </svg>
                    <span className="font-medium">
                      {isFriend ? 'Remove' : requestSent ? 'Request Sent' : 'Add Friend'}
                    </span>
                  </button>
                </>
              ) : (
                // Own Profile Actions
                <>
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-[#2b2d31] hover:bg-gray-300 dark:hover:bg-[#35373c] text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"></path>
                        </svg>
                        <span className="font-medium">Cancel</span>
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3BA55C] hover:bg-[#2D7D46] text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"></path>
                        </svg>
                        <span className="font-medium">Save Changes</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg transition-colors"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.2929 9.8299L19.9409 9.18278C20.5286 8.59489 20.5286 7.64245 19.9409 7.05454L16.9449 4.05854C16.3569 3.47065 15.4047 3.47065 14.8167 4.05854L14.1697 4.70558L19.2929 9.8299ZM12.8927 5.98278L5.18469 13.6908L5.00869 18.1608L9.47869 17.9848L17.1867 10.2768L12.8927 5.98278Z"></path>
                      </svg>
                      <span className="font-medium">Edit Profile</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileModal;
