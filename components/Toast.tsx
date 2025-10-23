"use client";

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';

// Types
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

// Context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Component
const ToastNotification: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(onRemove, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#22c55e]">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        );
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#ef4444]">
            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#eab308]">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#818cf8]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        );
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success': return 'border-[#22c55e]/30';
      case 'error': return 'border-[#ef4444]/30';
      case 'warning': return 'border-[#eab308]/30';
      default: return 'border-[#818cf8]/30';
    }
  };

  return (
    <div
      className={`
        min-w-[300px] max-w-[400px]
        bg-black/80 backdrop-blur-xl
        border ${getBorderColor()}
        rounded-lg p-4
        shadow-xl shadow-black/50
        animate-slide-in-right
        flex items-center gap-3
        transition-all duration-300 hover:scale-[1.02]
      `}
    >
      {getIcon()}
      <p className="text-sm text-[#e4e4e7] flex-1">{toast.message}</p>
      <button
        onClick={onRemove}
        className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  );
};

// Confirmation Dialog Component
const ConfirmDialog: React.FC<{
  message: string;
  title?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ message, title = 'Confirm Action', onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in">
      <div className="glass-dark rounded-xl p-6 w-full max-w-md animate-fade-in-up">
        <h3 className="text-lg font-bold text-[#e4e4e7] mb-4">{title}</h3>
        <p className="text-[#a1a1aa] mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="btn btn-secondary px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="btn btn-primary px-4 py-2"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    title?: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info', duration?: number) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void, title?: string) => {
    setConfirmDialog({ message, onConfirm, title });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9998] space-y-2">
        {toasts.map(toast => (
          <ToastNotification
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          title={confirmDialog.title}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </ToastContext.Provider>
  );
};

// CSS animations (add to your global CSS or tailwind config)
const styles = `
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out;
}
`;
