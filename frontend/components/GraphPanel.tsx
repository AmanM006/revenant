"use client";
// components/GraphPanel.tsx — Live knowledge graph panel using react-force-graph-2d with canvas animation and rumor flash

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphData, GraphNode, GraphLink } from "@/lib/types";
import { RumorToast } from "./RumorToast";
import { CallLogPanel } from "./CallLogPanel";

// Dynamic import — ForceGraph2D is canvas-based, no SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface Props {
  graphData: GraphData;
  dissolvingNodes: Set<string>;
  pulsatingEdges: Array<{ from: string; to: string }>;
}



export function GraphPanel({ graphData, dissolvingNodes, pulsatingEdges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 360, height: 400 });
  const [showFlash, setShowFlash] = useState(false);
  const prevEdgesCount = useRef(pulsatingEdges.length);

  // Dissolve animation state
  const [dissolveTimes, setDissolveTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    const now = Date.now();
    let changed = false;
    const nextTimes = { ...dissolveTimes };
    for (const node of Array.from(dissolvingNodes)) {
      if (!nextTimes[node]) {
        nextTimes[node] = now;
        changed = true;
      }
    }
    if (changed) {
      setDissolveTimes(nextTimes);
    }
  }, [dissolvingNodes, dissolveTimes]);

  // Flash overlay trigger when a rumor is injected
  useEffect(() => {
    if (pulsatingEdges.length > prevEdgesCount.current) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 2000);
      return () => clearTimeout(timer);
    }
    prevEdgesCount.current = pulsatingEdges.length;
  }, [pulsatingEdges]);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        setDimensions({
          width: e.contentRect.width,
          height: e.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Node Canvas Painter
  const nodeCanvasObject = useCallback(
    (rawNode: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = rawNode as GraphNode & { x?: number; y?: number };
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const nodeId = String(node.id ?? "");

      const labelText = String(node.label ?? node.id ?? "");
      const lowercaseLabel = labelText.toLowerCase();

      const isNPC = node.nodeType === "npc";
      const isPlayer = node.nodeType === "player";
      const isRumor = node.nodeType === "rumor";
      const isTrust = node.nodeType === "trust";

      const color = node.color || "#3B82F6";

      let radius = isNPC ? 10 : 5;
      let alpha = 1;

      // Animate node dissolve
      const startTime = dissolveTimes[nodeId];
      if (startTime) {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / 600); // 600ms duration
        radius *= 1 - progress;
        alpha *= 1 - progress;
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;

      if (isNPC) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
      }
      ctx.fill();

      // Thin stroke
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Render Label
      if (isNPC || globalScale > 2) {
        ctx.font = `${isNPC ? "700" : "400"} ${isNPC ? 10 : 8}px Cinzel`;
        ctx.fillStyle = "#E2E8F0";
        ctx.textAlign = "center";
        ctx.shadowBlur = 0;
        const namePart = labelText.split("_")[0]?.substring(0, 12) || "";
        ctx.fillText(namePart, x, y + radius + 10);
      }

      ctx.restore();
    },
    [dissolveTimes]
  );

  return (
    <div className="flex flex-col h-full bg-void rounded-xl border border-border p-3 overflow-hidden shadow-xl">
      {/* Graph Area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden rounded-lg bg-[#06080F]">
        <ForceGraph2D
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#06080F"
          nodeCanvasObject={nodeCanvasObject}
          nodeRelSize={6}
          linkColor={(link: any) => {
            const l = link as GraphLink;
            if (l.edgeType === "rumor") return "rgba(249, 115, 22, 0.85)"; // vibrant orange-red
            if (l.edgeType === "trust") return "rgba(34, 197, 94, 0.8)"; // bright green
            return "rgba(30, 42, 69, 0.8)"; // near-invisible default
          }}
          linkWidth={(link: any) => {
            const l = link as GraphLink;
            return l.edgeType === "rumor" ? 2 : 1;
          }}
          linkLineDash={(link: any) => {
            const l = link as GraphLink;
            return l.edgeType === "rumor" ? [3, 2] : null;
          }}
          linkDirectionalParticles={(link: any) => {
            const l = link as GraphLink;
            return l.edgeType === "rumor" ? 4 : 0;
          }}
          linkDirectionalParticleColor={() => "rgba(249, 115, 22, 0.9)"}
          linkDirectionalParticleSpeed={0.005}
          cooldownTicks={100}
        />

        {/* Rumor Toast Notification (replaces current rumor notification) */}
        <RumorToast visible={showFlash} onDismiss={() => setShowFlash(false)} />

        {graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted font-mono text-xs text-center">
              No graph data yet.<br />
              Seeding world...
            </p>
          </div>
        )}
      </div>

      {/* Legend Block */}
      <div className="mt-3 flex flex-wrap justify-between items-center gap-y-1.5 border-t border-border/40 pt-3">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple" />
            <span className="text-[10px] font-mono text-secondary">NPC</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#F8FAFC]" />
            <span className="text-[10px] font-mono text-secondary">Player</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            <span className="text-[10px] font-mono text-secondary">Event</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "rgba(180, 100, 20, 0.9)" }} />
            <span className="text-[10px] font-mono text-secondary">Rumor</span>
          </div>
        </div>
        <div className="flex gap-x-2.5 items-center">
          <div className="flex items-center gap-1">
            <span className="w-3 border-t border-[#10B981]" />
            <span className="text-[10px] font-mono text-secondary">Trust</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed" style={{ borderColor: "rgba(180, 100, 20, 0.9)" }} />
            <span className="text-[10px] font-mono text-secondary">Rumor</span>
          </div>
        </div>
      </div>

      {/* Call Log Panel */}
      <CallLogPanel />
    </div>
  );
}
