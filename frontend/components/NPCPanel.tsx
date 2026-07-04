"use client";
// components/NPCPanel.tsx — Overhauled NPC selector panel with active SVG portraits and runic borders

import { useEffect, useState } from "react";
import { TrustSparkline } from "./TrustSparkline";
import { Silas } from "./portraits/Silas";
import { Elara } from "./portraits/Elara";
import { Kael } from "./portraits/Kael";
import type { NpcId, TrustHistoryEntry, Trajectory } from "@/lib/types";

interface NpcData {
  id: NpcId;
  name: string;
  role: string;
  trust: number;
  trajectory: Trajectory;
  history: TrustHistoryEntry[];
}

interface Props {
  npcs: NpcData[];
  selectedNpc: NpcId;
  loadingNpc?: string | null;
  onSelect: (id: NpcId) => void;
}

// Map NPC portraits
const PortraitComponent = ({ id, size }: { id: NpcId; size?: number }) => {
  switch (id) {
    case "silas":
      return <Silas size={size} />;
    case "elara":
      return <Elara size={size} />;
    case "kael":
      return <Kael size={size} />;
  }
};

// Signature Element: Runic border that traces its circuit when trust values change
function RunicBorder({ trust }: { trust: number }) {
  const [prevTrust, setPrevTrust] = useState(trust);
  const [animationClass, setAnimationClass] = useState("");
  const [borderColor, setBorderColor] = useState("text-purple/30");

  useEffect(() => {
    if (trust !== prevTrust) {
      const isPositive = trust > prevTrust;
      setBorderColor(isPositive ? "text-green" : "text-red");
      setAnimationClass("runic-circuit-active");
      setPrevTrust(trust);

      const timer = setTimeout(() => {
        setAnimationClass("");
        setBorderColor("text-purple/30");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [trust, prevTrust]);

  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${borderColor} transition-colors duration-300`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* Corner runes */}
      <path d="M 3 10 L 3 3 L 10 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 97 10 L 97 3 L 90 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 3 90 L 3 97 L 10 97" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 97 90 L 97 97 L 90 97" fill="none" stroke="currentColor" strokeWidth="1.5" />

      {/* Main boundary line */}
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="400"
        strokeDashoffset={animationClass ? "0" : "400"}
        className={animationClass ? "runic-circuit-active" : "opacity-30"}
        style={{
          transition: animationClass ? "none" : "stroke-dashoffset 0.5s ease-out, opacity 0.5s",
        }}
      />
    </svg>
  );
}

function trustColorClass(trust: number): string {
  if (trust >= 70) return "bg-green shadow-[0_0_8px_rgba(16,185,129,0.4)]";
  if (trust >= 40) return "bg-amber shadow-[0_0_8px_rgba(245,158,11,0.4)]";
  return "bg-red shadow-[0_0_8px_rgba(239,68,68,0.45)]";
}

function trajectoryDisplay(t: Trajectory): { label: string; className: string } {
  switch (t) {
    case "RISING":
      return { label: "▲ RISING", className: "text-green" };
    case "FALLING":
      return { label: "▼▼ FALLING", className: "text-red animate-pulse" };
    default:
      return { label: "── STABLE", className: "text-secondary/70" };
  }
}

export function NPCPanel({ npcs, selectedNpc, loadingNpc, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
      <h2 className="text-xs font-display tracking-widest text-muted uppercase font-semibold mb-1 px-1">
        NPC Intel
      </h2>

      {npcs.map((npc) => {
        const isSelected = npc.id === selectedNpc;
        const traj = trajectoryDisplay(npc.trajectory);
        const lowTrust = npc.trust < 40;

        return (
          <button
            key={npc.id}
            id={`npc-btn-${npc.id}`}
            onClick={() => onSelect(npc.id)}
            className={`
              w-full text-left rounded-xl p-3 border transition-all duration-300 relative overflow-hidden shrink-0
              ${
                isSelected
                  ? "border-purple bg-raised shadow-[0_0_20px_rgba(124,58,237,0.15)] border-l-[3px] border-l-purple-glow"
                  : lowTrust
                  ? "border-red/40 bg-surface hover:border-red/60 hover:bg-hover shadow-[0_0_12px_rgba(239,68,68,0.1)]"
                  : "border-border bg-surface hover:border-bright hover:bg-hover"
              }
            `}
          >
            {/* Background vector portal decoration */}
            <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-purple/5 blur-xl pointer-events-none" />

            {/* Portrait area */}
            <div className={`relative aspect-video w-full rounded-lg overflow-hidden mb-3 border bg-void transition-all duration-300 ${
              loadingNpc === npc.id ? "border-purple ring-2 ring-purple/50 animate-pulse" : "border-border"
            }`}>
              <PortraitComponent id={npc.id} />
              {/* Runic border overlay */}
              <RunicBorder trust={npc.trust} />
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 flex h-2 w-2 z-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-glow opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple"></span>
                </div>
              )}
            </div>

            {/* NPC Identity Info */}
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="font-display font-bold text-primary text-sm tracking-wide">
                {npc.id === "silas" ? "⚔ " : npc.id === "kael" ? "⚔ " : "✦ "}
                {npc.name}
              </span>
              <span className="font-mono font-bold text-xs text-amber-glow">
                {npc.trust}
              </span>
            </div>
            <div className="text-xs font-body text-secondary/80 mb-3">{npc.role}</div>

            {/* Trust Progress Bar */}
            <div className="mb-2">
              <div className="h-1.5 bg-void rounded-full overflow-hidden border border-border/40">
                <div
                  className={`h-full rounded-full trust-bar-fill ${trustColorClass(npc.trust)}`}
                  style={{ width: `${npc.trust}%` }}
                />
              </div>
            </div>

            {/* Trajectory */}
            <div className="flex justify-between items-center mb-2">
              <span className={`text-[10px] font-mono tracking-wider font-semibold ${traj.className}`}>
                {traj.label}
              </span>
              <span className="text-[9px] font-mono text-muted">
                Trust Score
              </span>
            </div>

            {/* Sparkline chart */}
            {npc.history && npc.history.length > 0 && (
              <div className="border-t border-border/40 pt-2 mt-2">
                <TrustSparkline history={npc.history} compact />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
