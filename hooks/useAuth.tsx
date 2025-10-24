"use client";

import { createContext, useContext, useEffect, useState } from "react";
import * as Auth from "@/lib/aws/auth";
import { AuthUser } from "@/lib/aws/auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up AWS Cognito auth listener...');
    const unsub = Auth.onAuthStateChanged(async (authUser) => {
      console.log('Auth state changed:', authUser ? 'User logged in' : 'User logged out');
      setUser(authUser);
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
