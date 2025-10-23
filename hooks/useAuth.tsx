"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { UnifiedAuthService, UnifiedAuthUser } from "@/lib/aws/unified-auth";
import { createUserProfile } from "@/lib/userService";

interface AuthContextType {
  user: UnifiedAuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UnifiedAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up auth listener...');
    const unsub = UnifiedAuthService.onAuthStateChanged(async (authUser) => {
      console.log('Auth state changed:', authUser ? 'User logged in' : 'User logged out');
      setUser(authUser);
      
      // Create or update user profile in database
      if (authUser) {
        try {
          await createUserProfile(authUser as any);
        } catch (error) {
          console.error('Error creating user profile:', error);
        }
      }
      
      console.log('Setting loading to false');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
