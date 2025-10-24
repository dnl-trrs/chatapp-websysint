"use client";

import { useEffect, useState } from "react";
import { userService } from "@/lib/aws/dynamodb-client";

export interface UserProfile {
  uid?: string;
  userId?: string;
  email?: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  bio?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  createdAt?: number;
  updatedAt?: number;
}

export const useUserProfile = (uid?: string | null) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!uid);
  
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!uid) return;
    
    console.log('updateProfile called with:', updates);
    
    try {
      // Update local state immediately for better UX
      setProfile(prev => {
        if (!prev) return null;
        const updated = { ...prev, ...updates };
        console.log('Updated local profile:', updated);
        return updated;
      });
      
      // Update in DynamoDB
      await userService.updateUser(uid, updates);
      
      // Fetch the updated profile to ensure consistency
      const userData = await userService.getUser(uid);
      if (userData) {
        const mappedProfile: UserProfile = {
          uid: userData.userId || uid,
          userId: userData.userId || uid,
          email: userData.email,
          displayName: userData.displayName,
          username: userData.username,
          photoURL: userData.photoURL,
          bio: userData.bio || '',
          status: userData.status || 'offline',
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        };
        setProfile(mappedProfile);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      // Revert on error
      const userData = await userService.getUser(uid);
      if (userData) {
        const mappedProfile: UserProfile = {
          uid: userData.userId || uid,
          userId: userData.userId || uid,
          email: userData.email,
          displayName: userData.displayName,
          username: userData.username,
          photoURL: userData.photoURL,
          bio: userData.bio || '',
          status: userData.status || 'offline',
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        };
        setProfile(mappedProfile);
      }
      throw error;
    }
  };

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // Fetch user profile from DynamoDB
    const fetchProfile = async () => {
      try {
        const userData = await userService.getUser(uid);
        console.log('useUserProfile - Fetched user data:', userData);
        if (userData) {
          // Map the DynamoDB data to our UserProfile interface
          const mappedProfile: UserProfile = {
            uid: userData.userId || uid,
            userId: userData.userId || uid,
            email: userData.email,
            displayName: userData.displayName,
            username: userData.username,
            photoURL: userData.photoURL,
            bio: userData.bio || '', // Ensure bio is included
            status: userData.status || 'offline',
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt
          };
          setProfile(mappedProfile);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Poll for updates every 5 seconds (DynamoDB doesn't have real-time subscriptions)
    const interval = setInterval(fetchProfile, 5000);

    return () => clearInterval(interval);
  }, [uid]);

  return { profile, loading, updateProfile } as const;
};

