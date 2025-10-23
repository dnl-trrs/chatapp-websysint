"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0b] relative overflow-hidden">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#818cf8]/10 via-transparent to-[#c084fc]/10 pointer-events-none" />
        
        {/* Animated background blobs */}
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
        <div className="absolute top-0 -right-4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-4000" />
        
        {/* Loading content */}
        <div className="relative z-10 flex flex-col items-center gap-8">
          {/* Circular loader */}
          <div className="relative w-24 h-24">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-[#27272a]"></div>
            {/* Animated spinning ring */}
            <div className="absolute inset-0 rounded-full border-4 border-t-[#818cf8] border-r-[#a78bfa] border-b-[#c084fc] border-l-transparent animate-spin"></div>
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#818cf8] to-[#c084fc] flex items-center justify-center animate-pulse">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M4.79805 3C3.80445 3 2.99805 3.8055 2.99805 4.8V15.6C2.99805 16.5936 3.80445 17.4 4.79805 17.4H7.49805V21L11.098 17.4H19.198C20.1925 17.4 20.998 16.5936 20.998 15.6V4.8C20.998 3.8055 20.1925 3 19.198 3H4.79805Z"/>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Loading text with pulsing dots */}
          <div className="flex items-center gap-1">
            <span className="text-xl font-semibold text-[#e4e4e7]">Loading</span>
            <span className="flex">
              <span className="text-xl font-semibold text-[#e4e4e7] animate-pulse">.</span>
              <span className="text-xl font-semibold text-[#e4e4e7] animate-pulse animation-delay-200">.</span>
              <span className="text-xl font-semibold text-[#e4e4e7] animate-pulse animation-delay-400">.</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
