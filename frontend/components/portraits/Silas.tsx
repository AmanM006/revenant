"use client";
// components/portraits/Silas.tsx — Abstract geometric anvil + hammer blacksmith portrait

interface Props {
  size?: number;
}

export function Silas({ size = 160 }: Props) {
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
        {/* Forge glow radial gradient */}
        <radialGradient id="forgeGlow" cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#7C2D12" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0C0F1A" stopOpacity="0" />
        </radialGradient>
        {/* Metal steel gradient */}
        <linearGradient id="metalSteel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4B5563" />
          <stop offset="50%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1F2937" />
        </linearGradient>
        {/* Golden glow gradient for hammer impacts */}
        <radialGradient id="sparkGlow" cx="50%" cy="40%" r="30%">
          <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dark space void background */}
      <rect width="160" height="160" rx="8" fill="#0C0F1A" />

      {/* Forge radial glow */}
      <circle cx="80" cy="110" r="70" fill="url(#forgeGlow)" />

      {/* Sparks in background */}
      <circle cx="50" cy="50" r="1.5" fill="#FCD34D" opacity="0.8" />
      <circle cx="110" cy="40" r="2" fill="#F97316" opacity="0.6" />
      <circle cx="40" cy="90" r="1" fill="#FCD34D" opacity="0.7" />
      <circle cx="120" cy="95" r="1.5" fill="#FCD34D" opacity="0.5" />

      {/* ANVIL (trapezoidal base and horn) */}
      {/* Base block */}
      <path d="M45 125 L115 125 L105 100 L55 100 Z" fill="url(#metalSteel)" stroke="#1F2937" strokeWidth="1.5" />
      {/* Middle neck */}
      <rect x="62" y="80" width="36" height="20" fill="url(#metalSteel)" stroke="#1F2937" strokeWidth="1.5" />
      {/* Anvil top block and horn */}
      {/* Horn points left (40,75) and block goes right (120,75) */}
      <path d="M40 70 C40 70 55 70 60 80 L100 80 L110 80 L120 70 L120 65 L60 65 C50 65 43 68 40 70 Z" fill="url(#metalSteel)" stroke="#1F2937" strokeWidth="1.5" />

      {/* HAMMER (rect handle and angled heavy steel head) */}
      {/* Handle */}
      <line x1="65" y1="95" x2="105" y2="45" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
      {/* Hammer Head (slanted, mid stroke) */}
      <rect x="92" y="32" width="22" height="14" rx="1" transform="rotate(-30 92 32)" fill="#9CA3AF" stroke="#1F2937" strokeWidth="1.5" />
      <rect x="108" y="27" width="10" height="14" transform="rotate(-30 108 27)" fill="#4B5563" />

      {/* Golden spark overlay */}
      <circle cx="80" cy="70" r="15" fill="url(#sparkGlow)" />
      <path d="M80 70 L72 65 M80 70 L88 78 M80 70 L68 74 M80 70 L92 68 M80 70 L76 82" stroke="#FCD34D" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
