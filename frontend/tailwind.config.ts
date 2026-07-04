import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        decorative: ["var(--font-decorative)", "cursive"],
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        // Compatibility mapping
        base:    "var(--bg-void)",
        surface: "var(--bg-surface)",
        border:  "var(--border)",
        accent:  "var(--purple)",
        accent2: "var(--amber)",
        danger:  "var(--red)",
        rumor:   "var(--orange)",
        text:    "var(--text-primary)",
        muted:   "var(--text-secondary)",

        // New design identity tokens
        void:      "var(--bg-void)",
        raised:    "var(--bg-raised)",
        hover:     "var(--bg-hover)",
        bright:    "var(--border-bright)",

        purple:    "var(--purple)",
        "purple-dim": "var(--purple-dim)",
        "purple-glow": "var(--purple-glow)",

        amber:     "var(--amber)",
        "amber-dim": "var(--amber-dim)",
        "amber-glow": "var(--amber-glow)",

        orange:    "var(--orange)",
        "orange-dim": "var(--orange-dim)",

        green:     "var(--green)",
        red:       "var(--red)",
        blue:      "var(--blue)",
        "blue-dim": "var(--blue-dim)",

        primary:   "var(--text-primary)",
        secondary: "var(--text-secondary)",
        ghost:     "var(--text-ghost)",
      },
      animation: {
        "rumor-pulse": "rumor-pulse 1.5s ease-in-out infinite",
        "node-dissolve": "node-dissolve 0.6s ease-out forwards",
        "slide-up": "slide-up 0.2s ease-out both",
        "fade-in": "fade-in 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
