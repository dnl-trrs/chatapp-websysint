"use client";

import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ 
  checked, 
  onChange, 
  label, 
  disabled = false,
  className = ''
}) => {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div className={`
          w-5 h-5 rounded-md
          bg-black/40 backdrop-blur-md
          border ${checked ? 'border-[#818cf8]/50' : 'border-white/10'}
          transition-all duration-200
          hover:bg-white/5
          ${checked ? 'bg-[#818cf8]/20' : ''}
          flex items-center justify-center
        `}>
          {checked && (
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none"
              className="animate-scale-in"
            >
              <path 
                d="M20 6L9 17L4 12" 
                stroke="#818cf8" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
      {label && (
        <span className="text-sm text-[#e4e4e7] select-none">
          {label}
        </span>
      )}
    </label>
  );
};

// Radio button component with same styling
interface RadioProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  className?: string;
}

export const Radio: React.FC<RadioProps> = ({ 
  checked, 
  onChange, 
  label, 
  disabled = false,
  name,
  value,
  className = ''
}) => {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <div className="relative">
        <input
          type="radio"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          name={name}
          value={value}
          className="sr-only"
        />
        <div className={`
          w-5 h-5 rounded-full
          bg-black/40 backdrop-blur-md
          border ${checked ? 'border-[#818cf8]/50' : 'border-white/10'}
          transition-all duration-200
          hover:bg-white/5
          ${checked ? 'bg-[#818cf8]/20' : ''}
          flex items-center justify-center
        `}>
          {checked && (
            <div className="w-2.5 h-2.5 rounded-full bg-[#818cf8] animate-scale-in" />
          )}
        </div>
      </div>
      {label && (
        <span className="text-sm text-[#e4e4e7] select-none">
          {label}
        </span>
      )}
    </label>
  );
};

// Toggle/Switch component
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ 
  checked, 
  onChange, 
  label, 
  disabled = false,
  className = ''
}) => {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div className={`
          w-11 h-6 rounded-full
          bg-black/40 backdrop-blur-md
          border ${checked ? 'border-[#818cf8]/50' : 'border-white/10'}
          transition-all duration-200
          hover:bg-white/5
          ${checked ? 'bg-[#818cf8]/20' : ''}
          relative
        `}>
          <div className={`
            absolute top-[2px] 
            w-5 h-5 rounded-full 
            bg-gradient-to-br ${checked ? 'from-[#818cf8] to-[#6366f1]' : 'from-[#71717a] to-[#52525b]'}
            shadow-lg
            transition-all duration-200
            ${checked ? 'left-[calc(100%-22px)]' : 'left-[2px]'}
          `} />
        </div>
      </div>
      {label && (
        <span className="text-sm text-[#e4e4e7] select-none">
          {label}
        </span>
      )}
    </label>
  );
};

// CSS animation (add to global CSS)
const styles = `
@keyframes scale-in {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}
`;
