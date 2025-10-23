"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthWrapper from "@/components/AuthWrapper";
import ChatDashboard from "./ChatDashboard";

function ChatContent() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Set mounted state on client
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0b]">
        <div className="text-[#e4e4e7] text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0b]">
        <div className="text-[#e4e4e7] text-lg">Please log in to continue</div>
      </div>
    );
  }

  return <ChatDashboard />;
}

export default function ChatPage() {
  return (
    <AuthWrapper>
      <ChatContent />
    </AuthWrapper>
  );
}
