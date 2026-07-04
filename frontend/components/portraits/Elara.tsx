"use client";
// components/portraits/Elara.tsx — Abstract geometric crescent moon + arcane circle mage portrait

interface Props {
  size?: number;
}

export function Elara({ size = 160 }: Props) {
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
        {/* Arcane energy portal radial gradient */}
        <radialGradient id="arcanePortal" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#4C1D95" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0C0F1A" stopOpacity="0" />
        </radialGradient>
        {/* Magic stars glow */}
        <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#4C1D95" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dark space background */}
      <rect width="160" height="160" rx="8" fill="#0C0F1A" />

      {/* Arcane base portal glow */}
      <circle cx="80" cy="80" r="70" fill="url(#arcanePortal)" />

      {/* COMPASS/TICK-MARK CIRCLE */}
      <circle cx="80" cy="80" r="54" stroke="#7C3AED" strokeWidth="1" strokeDasharray="3, 3" />
      <circle cx="80" cy="80" r="58" stroke="#4C1D95" strokeWidth="0.75" />

      {/* Compass cardinal lines */}
      <line x1="80" y1="20" x2="80" y2="28" stroke="#A78BFA" strokeWidth="1.5" />
      <line x1="80" y1="132" x2="80" y2="140" stroke="#A78BFA" strokeWidth="1.5" />
      <line x1="20" y1="80" x2="28" y2="80" stroke="#A78BFA" strokeWidth="1.5" />
      <line x1="132" y1="80" x2="140" y2="80" stroke="#A78BFA" strokeWidth="1.5" />

      {/* Abstract geometric stars background */}
      <circle cx="45" cy="45" r="1.5" fill="#C084FC" />
      <circle cx="115" cy="115" r="1.5" fill="#C084FC" />
      <circle cx="45" cy="115" r="1" fill="#C084FC" />
      <circle cx="115" cy="45" r="2" fill="#C084FC" />

      {/* ARCANE RUNE TRIANGLES (representing magic circle) */}
      <polygon points="80,32 121,104 39,104" stroke="#4C1D95" strokeWidth="0.75" />
      <polygon points="80,128 39,56 121,56" stroke="#4C1D95" strokeWidth="0.75" />

      {/* CRESCENT MOON (Center element) */}
      {/* Outer circle: radius 26, offset slightly left. Inner circle: subtract. */}
      <path
        d="M 88 54 C 73.6 54 62 65.6 62 80 C 62 94.4 73.6 106 88 106 C 81.3 106 72 99.3 72 80 C 72 60.7 81.3 54 88 54 Z"
        fill="#A78BFA"
        stroke="#7C3AED"
        strokeWidth="1"
      />

      {/* 6 STAR PATHS / MAGIC SPARKS AROUND CRESCENT */}
      {/* Four point geometric stars */}
      <path d="M 60 48 L 62 52 L 66 54 L 62 56 L 60 60 L 58 56 L 54 54 L 58 52 Z" fill="#C084FC" />
      <path d="M 110 52 L 111.5 55 L 115 56.5 L 111.5 58 L 110 61 L 108.5 58 L 105 56.5 L 108.5 55 Z" fill="#A78BFA" />
      <path d="M 94 92 L 95 94 L 97 95 L 95 96 L 94 98 L 93 96 L 91 95 L 93 94 Z" fill="#E9D5FF" />
      <path d="M 68 96 L 69 98 L 71 99 L 69 100 L 68 102 L 67 100 L 65 99 L 67 98 Z" fill="#C084FC" />
      <circle cx="80" cy="80" r="10" fill="url(#starGlow)" opacity="0.3" />
    </svg>
  );
}
