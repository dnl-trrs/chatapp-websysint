"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/components/Toast';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const { showToast } = useToast();
  
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>('');


  useEffect(() => {
    if (profile?.photoURL && (profile.photoURL.startsWith('http') || profile.photoURL.startsWith('data:image'))) {
      setUploadPreview(profile.photoURL);
    }
  }, [profile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be less than 5MB", 'warning');
        return;
      }
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSave = () => {
    // Placeholder for future implementation
    showToast('Profile picture update functionality coming soon!', 'info');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-dark rounded-xl p-6 w-full max-w-lg animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#e4e4e7]">Choose Profile Picture</h2>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Current Profile Picture Preview */}
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center border-4 border-[#27272a]">
              {uploadPreview ? (
                <Image
                  src={uploadPreview}
                  alt="Profile"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              ) : profile?.photoURL && (profile.photoURL.startsWith('http') || profile.photoURL.startsWith('data:')) ? (
                <Image
                  src={profile.photoURL}
                  alt="Profile"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-white text-3xl font-bold">
                  {profile?.displayName?.[0]?.toUpperCase() || user?.displayName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          </div>

          {/* Upload Image */}
          <div>
            <h3 className="text-sm text-[#a1a1aa] mb-3">Upload Profile Picture</h3>
            <label 
              htmlFor="profile-picture-upload"
              className="block w-full btn btn-secondary py-2 text-center cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="inline mr-2">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Upload Image
            </label>
            <input
              id="profile-picture-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <p className="text-xs text-[#71717a] mt-2">Maximum file size: 5MB</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="btn btn-secondary px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary px-4 py-2"
          >
            Save Picture
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;
