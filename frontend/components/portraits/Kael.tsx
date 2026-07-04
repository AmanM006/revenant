"use client";
// components/portraits/Kael.tsx — Abstract geometric guard captain shield + crossed swords portrait

interface Props {
  size?: number;
}

export function Kael({ size = 160 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <defs>
        {/* Guard glow gradient */}
        <radialGradient id="guardGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0C0F1A" stopOpacity="0" />
        </radialGradient>
        {/* Steel shield gradient */}
        <linearGradient id="shieldSteel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Dark background */}
      <rect width="160" height="160" rx="8" fill="#0C0F1A" />

      {/* Guard radial glow */}
      <circle cx="80" cy="80" r="60" fill="url(#guardGlow)" />

      {/* CROSSED SWORDS (drawn diagonally behind the shield) */}
      {/* Sword 1 (top-left to bottom-right) */}
      {/* Blade */}
      <path d="M28 28 L112 112" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
      <path d="M28 28 L112 112" stroke="#F1F5F9" strokeWidth="1" strokeLinecap="round" />
      {/* Crossguard */}
      <path d="M104 100 L96 108" stroke="#E2E8F0" strokeWidth="5" strokeLinecap="round" />
      {/* Hilt/Handle */}
      <path d="M110 110 L122 122" stroke="#1E3A5F" strokeWidth="4" strokeLinecap="round" />
      {/* Pommel */}
      <circle cx="122" cy="122" r="3" fill="#94A3B8" />

      {/* Sword 2 (top-right to bottom-left) */}
      {/* Blade */}
      <path d="M132 28 L48 112" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
      <path d="M132 28 L48 112" stroke="#F1F5F9" strokeWidth="1" strokeLinecap="round" />
      {/* Crossguard */}
      <path d="M56 100 L64 108" stroke="#E2E8F0" strokeWidth="5" strokeLinecap="round" />
      {/* Hilt/Handle */}
      <path d="M50 110 L38 122" stroke="#1E3A5F" strokeWidth="4" strokeLinecap="round" />
      {/* Pommel */}
      <circle cx="38" cy="122" r="3" fill="#94A3B8" />

      {/* SHIELD (Classic Kite Shield Shape) */}
      {/* Curved path representing shield body */}
      {/* Starts top-center (80,45), sweeps top-right (116,50), down to point (80,125), sweeps back to top-left (44,50) */}
      <path
        d="M 80 35 C 100 35 116 42 116 46 C 116 80 106 112 80 128 C 54 112 44 80 44 46 C 44 42 60 35 80 35 Z"
        fill="url(#shieldSteel)"
        stroke="#475569"
        strokeWidth="2"
      />

      {/* Silver central stripe on shield */}
      <path d="M 80 35 L 80 128" stroke="#E2E8F0" strokeWidth="1.5" />

      {/* Golden crown emblem at top of shield */}
      <path
        d="M 72 58 L 70 65 L 75 62 L 80 67 L 85 62 L 90 65 L 88 58 Z"
        fill="#F59E0B"
        stroke="#78350F"
        strokeWidth="0.75"
      />

      {/* Shield border details */}
      <path
        d="M 80 40 C 96 40 110 46 110 50 C 110 78 100 106 80 121 C 60 106 50 78 50 50 C 50 46 64 40 80 40 Z"
        stroke="#E2E8F0"
        strokeWidth="0.75"
        strokeDasharray="4, 2"
        opacity="0.6"
      />
    </svg>
  );
}
