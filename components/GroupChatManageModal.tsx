"use client";

import React, { useState, useEffect } from 'react';
import { getFriends } from '@/lib/friendService';
import { addParticipantsToGroup, removeParticipantFromGroup, getConversationWithDetails } from '@/lib/conversationService';

interface GroupChatManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupChat: {
    id: string;
    name: string;
    createdBy: string;
    participants: number;
    participantIds?: string[];
  };
  currentUserId: string;
  onRename: (newName: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const GroupChatManageModal: React.FC<GroupChatManageModalProps> = ({
  isOpen,
  onClose,
  groupChat,
  currentUserId,
  onRename,
  onLeave,
  onDelete
}) => {
  const [newName, setNewName] = useState(groupChat.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const isCreator = groupChat.createdBy === currentUserId;

  useEffect(() => {
    if (isOpen && showInviteModal) {
      loadAvailableFriends();
    }
    if (isOpen && showManageMembersModal) {
      loadGroupMembers();
    }
  }, [isOpen, showInviteModal, showManageMembersModal]);

  const loadAvailableFriends = async () => {
    try {
      const friends = await getFriends(currentUserId);
      // Filter out friends who are already in the group
      const filtered = groupChat.participantIds 
        ? friends.filter(friend => !groupChat.participantIds?.includes(friend.uid))
        : friends;
      setAvailableFriends(filtered);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  };

  const handleInviteUsers = async () => {
    if (selectedFriends.length === 0) return;
    
    setLoading(true);
    setError('');
    try {
      await addParticipantsToGroup(groupChat.id, selectedFriends, currentUserId);
      setShowInviteModal(false);
      setSelectedFriends([]);
      // Refresh the group data
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to invite users');
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = availableFriends.filter(friend => 
    friend.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadGroupMembers = async () => {
    try {
      const details = await getConversationWithDetails(groupChat.id);
      if (details && details.participantDetails) {
        setGroupMembers(details.participantDetails);
      }
    } catch (err) {
      console.error('Error loading group members:', err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMember(memberId);
    setError('');
    try {
      await removeParticipantFromGroup(groupChat.id, memberId, currentUserId);
      // Reload members
      await loadGroupMembers();
      // Update participant count
      groupChat.participants = groupChat.participants - 1;
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === groupChat.name) return;
    
    setLoading(true);
    setError('');
    try {
      await onRename(newName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to rename group');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLoading(true);
    setError('');
    try {
      await onLeave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to leave group');
    } finally {
      setLoading(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete group');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-dark rounded-xl p-6 w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#e4e4e7]">Manage Group Chat</h2>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
            disabled={loading}
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

        {!showDeleteConfirm && !showLeaveConfirm && !showInviteModal && !showManageMembersModal ? (
          <div className="space-y-4">
            {/* Rename Group */}
            <div>
              <label className="block text-sm text-[#a1a1aa] mb-2">Group Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input flex-1"
                  placeholder="Enter group name"
                  disabled={loading}
                />
                <button
                  onClick={handleRename}
                  className="btn btn-primary px-4"
                  disabled={loading || !newName.trim() || newName === groupChat.name}
                >
                  Rename
                </button>
              </div>
            </div>

            {/* Group Info */}
            <div className="bg-[#18181b] rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-[#71717a]">Participants</span>
                <span className="text-sm text-[#e4e4e7]">{groupChat.participants}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#71717a]">Your Role</span>
                <span className="text-sm text-[#e4e4e7]">{isCreator ? 'Creator' : 'Member'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
                disabled={loading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Invite Users
              </button>
              
              {isCreator && (
                <button
                  onClick={() => setShowManageMembersModal(true)}
                  className="w-full btn btn-secondary flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  Manage Members
                </button>
              )}
              {!isCreator && (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="w-full btn btn-secondary flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                  </svg>
                  Leave Group
                </button>
              )}
              
              {isCreator && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full btn bg-[#ef4444] hover:bg-[#dc2626] text-white flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                  Delete Group
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Confirmation Dialogs */}
            {showLeaveConfirm && (
              <>
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-[#ef4444]/20 flex items-center justify-center mx-auto mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#ef4444">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">Leave Group?</h3>
                  <p className="text-sm text-[#71717a]">
                    Are you sure you want to leave "{groupChat.name}"? 
                    You'll need to be re-invited to join again.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="flex-1 btn btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLeave}
                    className="flex-1 btn bg-[#ef4444] hover:bg-[#dc2626] text-white"
                    disabled={loading}
                  >
                    {loading ? 'Leaving...' : 'Leave Group'}
                  </button>
                </div>
              </>
            )}

            {showDeleteConfirm && (
              <>
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-[#ef4444]/20 flex items-center justify-center mx-auto mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#ef4444">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">Delete Group?</h3>
                  <p className="text-sm text-[#71717a] mb-2">
                    Are you sure you want to delete "{groupChat.name}"?
                  </p>
                  <p className="text-xs text-[#ef4444]">
                    This action cannot be undone. All messages will be permanently deleted.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 btn btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 btn bg-[#ef4444] hover:bg-[#dc2626] text-white"
                    disabled={loading}
                  >
                    {loading ? 'Deleting...' : 'Delete Group'}
                  </button>
                </div>
              </>
            )}

            {showManageMembersModal && (
              <>
                <div className="text-center py-4">
                  <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">Manage Members</h3>
                  <p className="text-sm text-[#71717a] mb-4">
                    Remove members from this group
                  </p>
                  
                  {/* Members List */}
                  <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                    {groupMembers.length === 0 ? (
                      <p className="text-sm text-[#71717a] py-4">Loading members...</p>
                    ) : (
                      groupMembers
                        .filter(member => member.id !== currentUserId) // Don't show current user
                        .map(member => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-[#27272a]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center text-white text-xs font-semibold">
                                {member.displayName?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div className="text-left">
                                <p className="text-sm text-[#e4e4e7]">{member.displayName || 'Unknown'}</p>
                                <p className="text-xs text-[#71717a]">@{member.username || 'unknown'}</p>
                              </div>
                            </div>
                            {member.id === groupChat.createdBy ? (
                              <span className="text-xs text-[#818cf8] px-2 py-1 bg-[#818cf8]/10 rounded-full">
                                Creator
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={removingMember === member.id}
                                className="px-3 py-1 text-xs bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] rounded-lg transition-all"
                              >
                                {removingMember === member.id ? 'Removing...' : 'Remove'}
                              </button>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowManageMembersModal(false)}
                    className="flex-1 btn btn-secondary"
                    disabled={removingMember !== null}
                  >
                    Done
                  </button>
                </div>
              </>
            )}

            {showInviteModal && (
              <>
                <div className="text-center py-4">
                  <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">Invite Friends</h3>
                  <p className="text-sm text-[#71717a] mb-4">
                    Select friends to invite to this group
                  </p>
                  
                  {/* Search */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full input mb-4"
                    placeholder="Search friends..."
                  />
                  
                  {/* Friends List */}
                  <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                    {filteredFriends.length === 0 ? (
                      <p className="text-sm text-[#71717a] py-4">
                        {searchQuery ? 'No friends found' : 'No friends available to invite'}
                      </p>
                    ) : (
                      filteredFriends.map(friend => (
                        <label
                          key={friend.uid}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#27272a] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFriends.includes(friend.uid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFriends([...selectedFriends, friend.uid]);
                              } else {
                                setSelectedFriends(selectedFriends.filter(id => id !== friend.uid));
                              }
                            }}
                            className="w-4 h-4 rounded border-[#27272a] bg-[#18181b] text-[#818cf8] focus:ring-[#818cf8]"
                          />
                          <div className="flex-1 text-left">
                            <p className="text-sm text-[#e4e4e7]">{friend.displayName}</p>
                            <p className="text-xs text-[#71717a]">@{friend.username}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowInviteModal(false);
                      setSelectedFriends([]);
                      setSearchQuery('');
                    }}
                    className="flex-1 btn btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInviteUsers}
                    className="flex-1 btn btn-primary"
                    disabled={loading || selectedFriends.length === 0}
                  >
                    {loading ? 'Inviting...' : `Invite ${selectedFriends.length} User${selectedFriends.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupChatManageModal;
