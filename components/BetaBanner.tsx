'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function BetaBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if banner has been dismissed in this session
    const dismissed = sessionStorage.getItem('beta-banner-dismissed');
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('beta-banner-dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-md border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex items-center flex-1">
            <AlertTriangle className="h-5 w-5 text-amber-400 mr-2 flex-shrink-0" />
            <p className="text-sm font-medium text-white">
              <span className="font-bold">Beta Version:</span> This application is currently in development. 
              Features may be incomplete or change without notice. We appreciate your patience and feedback!
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="ml-3 inline-flex items-center justify-center p-1 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5 text-white/80 hover:text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}