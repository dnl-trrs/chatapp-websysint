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
        setProfile(userData as UserProfile);
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

  return { profile, loading } as const;
};

