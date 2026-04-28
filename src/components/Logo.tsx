import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export const Logo = ({ size = 32, className = "", glow = true }: LogoProps) => (
  <div className={`relative flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" className={`w-full h-full ${glow ? 'drop-shadow-[0_0_12px_rgba(34,197,94,0.6)]' : ''}`}>
      {/* Magnifying Glass Handle */}
      <rect x="68" y="68" width="22" height="8" rx="4" transform="rotate(45 68 68)" fill="#475569" />
      {/* Magnifying Glass Circle */}
      <circle cx="45" cy="45" r="38" fill="none" stroke="#22C55E" strokeWidth="7" />
      {/* Bars */}
      <rect x="25" y="55" width="10" height="15" rx="2" fill="#22C55E" />
      <rect x="40" y="40" width="10" height="30" rx="2" fill="#00FF88" />
      <rect x="55" y="25" width="10" height="45" rx="2" fill="#22C55E" />
      {/* Arrow */}
      <path d="M20 70 L85 15 M85 15 L70 15 M85 15 L85 30" stroke="#00FF88" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  </div>
);
