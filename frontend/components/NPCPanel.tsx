"use client";
// components/NPCPanel.tsx — NPC selector with trust bars and sparklines

import { TrustSparkline } from "./TrustSparkline";
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
  onSelect: (id: NpcId) => void;
}

// SVG NPC portraits — distinct per character
const NpcPortrait = ({ id, size = 40 }: { id: NpcId; size?: number }) => {
  const configs: Record<NpcId, { bg: string; icon: string }> = {
    silas: { bg: "#78350F", icon: "🔨" },
    elara: { bg: "#4C1D95", icon: "✦" },
    kael: { bg: "#1E3A5F", icon: "⚔" },
  };
  const cfg = configs[id];
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold text-white border-2 border-border"
      style={{ width: size, height: size, background: cfg.bg, fontSize: size * 0.4 }}
    >
      {cfg.icon}
    </div>
  );
};

function trustColor(trust: number): string {
  if (trust >= 60) return "bg-green-500";
  if (trust >= 30) return "bg-amber-500";
  return "bg-danger";
}

function trajectoryDisplay(t: Trajectory): { label: string; className: string } {
  switch (t) {
    case "RISING":
      return { label: "▲ RISING", className: "text-green-400" };
    case "FALLING":
      return { label: "▼▼ FALLING", className: "text-danger" };
    default:
      return { label: "── STABLE", className: "text-muted" };
  }
}

export function NPCPanel({ npcs, selectedNpc, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-1">
      <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-1 px-1">
        NPCs
      </h2>
      {npcs.map((npc) => {
        const isSelected = npc.id === selectedNpc;
        const traj = trajectoryDisplay(npc.trajectory);

        return (
          <button
            key={npc.id}
            id={`npc-btn-${npc.id}`}
            onClick={() => onSelect(npc.id)}
            className={`
              w-full text-left rounded-lg p-3 border transition-all duration-200
              ${
                isSelected
                  ? "border-accent bg-accent/10 shadow-[0_0_16px_rgba(124,58,237,0.2)]"
                  : "border-border bg-surface hover:border-accent/40 hover:bg-white/5"
              }
            `}
          >
            {/* Header row */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="relative">
                <NpcPortrait id={npc.id} />
                {isSelected && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-display font-semibold text-text leading-tight">
                  {npc.name}
                </div>
                <div className="text-xs text-muted leading-tight">{npc.role}</div>
              </div>
              <div className="ml-auto text-xs font-mono font-bold text-accent2">
                {npc.trust}
              </div>
            </div>

            {/* Trust bar */}
            <div className="mb-1">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${trustColor(npc.trust)}`}
                  style={{ width: `${npc.trust}%` }}
                />
              </div>
            </div>

            {/* Trajectory */}
            <div className={`text-[10px] font-mono mb-2 ${traj.className}`}>
              {traj.label}
            </div>

            {/* Sparkline */}
            {npc.history.length > 1 && (
              <TrustSparkline history={npc.history} compact />
            )}
          </button>
        );
      })}
    </div>
  );
}
