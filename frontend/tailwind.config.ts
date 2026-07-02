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
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        base:    "var(--color-base)",
        surface: "var(--color-surface)",
        border:  "var(--color-border)",
        accent:  "var(--color-accent)",
        accent2: "var(--color-accent2)",
        danger:  "var(--color-danger)",
        rumor:   "var(--color-rumor)",
        text:    "var(--color-text)",
        muted:   "var(--color-muted)",
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
