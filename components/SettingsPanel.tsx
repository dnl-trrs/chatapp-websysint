"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { updateUserProfile } from '@/lib/userService';
import { db } from '@/lib/firebase';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/components/Toast';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEditProfile?: () => void;
  onViewProfile?: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, onEditProfile, onViewProfile }) => {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const { showToast, showConfirm } = useToast();
  const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'preferences'>('account');
  const [status, setStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>(profile?.status || 'online');
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  
  // Profile edit states
  const [editDisplayName, setEditDisplayName] = useState(profile?.displayName || '');
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  
  // Update edit states when profile changes
  React.useEffect(() => {
    if (profile) {
      setEditDisplayName(profile.displayName || '');
      setEditUsername(profile.username || '');
      setEditBio(profile.bio || '');
      setStatus(profile.status || 'online');
    }
  }, [profile]);

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    // If username hasn't changed, it's available
    if (usernameToCheck === profile?.username) {
      setUsernameAvailable(true);
      return;
    }
    
    setCheckingUsername(true);
    try {
      const q = query(collection(db, "users"), where("username", "==", usernameToCheck.toLowerCase()));
      const querySnapshot = await getDocs(q);
      setUsernameAvailable(querySnapshot.empty);
    } catch (error) {
      console.error("Error checking username:", error);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setEditUsername(value);
    if (value.length >= 3) {
      checkUsernameAvailability(value);
    } else {
      setUsernameAvailable(null);
    }
  };

  const handleLogout = async () => {
    showConfirm(
      'Are you sure you want to log out?',
      async () => {
        try {
          await signOut(auth);
          showToast('Logged out successfully', 'success');
        } catch (error) {
          console.error('Error signing out:', error);
          showToast('Failed to log out', 'error');
        }
      },
      'Log Out'
    );
  };

  const handleStatusChange = async (newStatus: 'online' | 'idle' | 'dnd' | 'offline') => {
    setStatus(newStatus);
    if (user?.uid) {
      try {
        await updateUserProfile(user.uid, { status: newStatus });
      } catch (error) {
        console.error('Error updating status:', error);
      }
    }
  };

  const getStatusColor = (statusType?: string) => {
    switch (statusType) {
      case 'online': return 'bg-[#22c55e]';
      case 'idle': return 'bg-[#eab308]';
      case 'dnd': return 'bg-[#ef4444]';
      default: return 'bg-[#71717a]';
    }
  };

  const getStatusLabel = (statusType?: string) => {
    switch (statusType) {
      case 'online': return 'Online';
      case 'idle': return 'Away';
      case 'dnd': return 'Do Not Disturb';
      case 'offline': return 'Appear Offline';
      default: return 'Online';
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
          width: 'calc(20rem - 2rem)', // Match the sidebar width minus its padding
          transformOrigin: 'bottom',
          maxHeight: 'calc(100vh - 200px)'
        }}
      >
        <div className="flex flex-col h-[450px]">
          {/* Header - matches profile tile padding */}
          <div className="p-4 pb-0 border-b border-[#27272a]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#e4e4e7]">Settings</h2>
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
                onClick={() => setActiveTab('account')}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-all relative ${
                  activeTab === 'account' 
                    ? 'text-[#e4e4e7]' 
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Account
                {activeTab === 'account' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-all relative ${
                  activeTab === 'profile' 
                    ? 'text-[#e4e4e7]' 
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Profile
                {activeTab === 'profile' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-all relative ${
                  activeTab === 'preferences' 
                    ? 'text-[#e4e4e7]' 
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Settings
                {activeTab === 'preferences' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#818cf8]" />
                )}
              </button>
            </div>
          </div>

          {/* Content - matches profile tile padding */}
          <div className="flex-1 p-4 overflow-hidden">
            <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#27272a] scrollbar-track-transparent">
            {activeTab === 'account' ? (
              <div className="space-y-4">
                {/* User Info Display */}
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:bg-[#27272a] rounded-lg p-2 transition-colors"
                  onClick={onViewProfile}
                >
                  {profile?.photoURL ? (
                    <Image
                      src={profile.photoURL}
                      alt={profile.displayName || 'Profile'}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-sm font-semibold">
                      {profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-[#e4e4e7] font-medium">{profile?.displayName || 'User'}</p>
                    <p className="text-xs text-[#71717a]">@{profile?.username || 'username'}</p>
                  </div>
                </div>

                {/* Status Selection */}
                <div className="border-t border-[#27272a] pt-3">
                  <label className="text-xs text-[#a1a1aa] mb-2 block">Status</label>
                  <div className="space-y-1">
                    {(['online', 'idle', 'dnd', 'offline'] as const).map((statusOption) => (
                      <button
                        key={statusOption}
                        onClick={() => handleStatusChange(statusOption)}
                        className={`w-full p-2 rounded-lg flex items-center gap-2 transition-colors ${
                          status === statusOption 
                            ? 'bg-[#27272a]' 
                            : 'hover:bg-[#18181b]'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(statusOption)}`} />
                        <span className="text-xs text-[#e4e4e7]">{getStatusLabel(statusOption)}</span>
                        {status === statusOption && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#818cf8" className="ml-auto">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logout Button */}
                <div className="border-t border-[#27272a] pt-3">
                  <button
                    onClick={handleLogout}
                    className="w-full btn bg-[#ef4444] hover:bg-[#dc2626] text-white py-1.5 text-xs"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            ) : activeTab === 'profile' ? (
              // Edit Profile Tab
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#a1a1aa] mb-2 block">Display Name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Enter display name"
                    className="input w-full text-sm"
                    maxLength={32}
                  />
                </div>

                <div>
                  <label className="text-xs text-[#a1a1aa] mb-2 block">Username</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editUsername}
                      onChange={handleUsernameChange}
                      placeholder="unique_username"
                      className="input w-full text-sm pr-10"
                      maxLength={20}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername && (
                        <svg className="animate-spin h-4 w-4 text-[#818cf8]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {!checkingUsername && usernameAvailable === true && editUsername.length >= 3 && (
                        <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {!checkingUsername && usernameAvailable === false && (
                        <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {usernameAvailable === false && (
                    <p className="text-[10px] text-red-400 mt-1">Username is already taken</p>
                  )}
                  {editUsername.length > 0 && editUsername.length < 3 && (
                    <p className="text-[10px] text-[#71717a] mt-1">Username must be at least 3 characters</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-[#a1a1aa] mb-2 block">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us about yourself"
                    className="input w-full text-sm resize-none"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-[10px] text-[#71717a] mt-1">{editBio.length}/200</p>
                </div>

                <div>
                  <label className="text-xs text-[#a1a1aa] mb-2 block">Profile Picture</label>
                  <button
                    onClick={onEditProfile}
                    className="w-full btn btn-secondary py-1.5 text-xs"
                  >
                    Change Avatar
                  </button>
                </div>

                <div className="border-t border-[#27272a] pt-3">
                  <button
                    onClick={async () => {
                      if (user?.uid && editDisplayName && (editUsername.length === 0 || (editUsername.length >= 3 && usernameAvailable !== false))) {
                        setIsUpdating(true);
                        try {
                          await updateUserProfile(user.uid, {
                            displayName: editDisplayName,
                            username: editUsername.toLowerCase(),
                            bio: editBio
                          });
                          alert('Profile updated successfully!');
                        } catch (error) {
                          console.error('Error updating profile:', error);
                          alert('Failed to update profile');
                        } finally {
                          setIsUpdating(false);
                        }
                      }
                    }}
                    disabled={isUpdating || !editDisplayName || (editUsername.length > 0 && editUsername.length < 3) || usernameAvailable === false}
                    className="w-full btn btn-primary py-1.5 text-xs"
                  >
                    {isUpdating ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              // Settings Tab (Combined Preferences & Privacy)
              <div className="space-y-5">
                {/* PREFERENCES SECTION */}
                <div>
                  <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase mb-3">Preferences</h3>
                  
                  {/* Notifications */}
                  <div className="space-y-2 mb-3">
                    <label className="flex items-center justify-between p-2 rounded-lg hover:bg-[#18181b] cursor-pointer">
                      <span className="text-xs text-[#e4e4e7]">Desktop Notifications</span>
                      <input
                        type="checkbox"
                        checked={notifications}
                        onChange={(e) => setNotifications(e.target.checked)}
                        className="rounded border-[#3f3f46] bg-[#18181b] text-[#818cf8]"
                      />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded-lg hover:bg-[#18181b] cursor-pointer">
                      <span className="text-xs text-[#e4e4e7]">Message Sounds</span>
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => setSoundEnabled(e.target.checked)}
                        className="rounded border-[#3f3f46] bg-[#18181b] text-[#818cf8]"
                      />
                    </label>
                  </div>
                </div>

                {/* DIVIDER */}
                <div className="border-t border-[#27272a]"></div>

                {/* PRIVACY SECTION */}
                <div>
                  <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase mb-3">Privacy</h3>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-2 rounded-lg hover:bg-[#18181b] cursor-pointer">
                      <div>
                        <p className="text-xs text-[#e4e4e7]">Show Online Status</p>
                        <p className="text-[10px] text-[#71717a]">Let others see when you're online</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={showOnlineStatus}
                        onChange={(e) => setShowOnlineStatus(e.target.checked)}
                        className="rounded border-[#3f3f46] bg-[#18181b] text-[#818cf8]"
                      />
                    </label>
                  </div>
                  
                  {/* Blocked Users */}
                  <div className="mt-3">
                    <p className="text-xs text-[#71717a]">No blocked users</p>
                    <button className="mt-2 text-xs text-[#818cf8] hover:text-[#6366f1]">
                      Manage Blocked Users
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
