"use client";
// components/GraphPanel.tsx — react-force-graph-2d live knowledge graph

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphData, GraphNode } from "@/lib/types";

// Dynamic import — ForceGraph2D is canvas-based, no SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface Props {
  graphData: GraphData;
  dissolvingNodes: Set<string>;
  pulsatingEdges: Array<{ from: string; to: string }>;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  npc: "#7C3AED",
  player: "#F8FAFC",
  rumor: "#F97316",
  trust: "#F59E0B",
  event: "#3B82F6",
  unknown: "#64748B",
};

const EDGE_TYPE_COLORS: Record<string, string> = {
  trust: "#22C55E",
  rumor: "#F97316",
  event: "#3B82F6",
  unknown: "#64748B",
};

const NODE_LABELS: Record<string, string> = {
  silas: "Silas",
  elara: "Elara",
  kael: "Kael",
  player: "Player",
};

const LEGEND = [
  { type: "NPC", color: "#7C3AED" },
  { type: "Player", color: "#F8FAFC" },
  { type: "Event", color: "#3B82F6" },
  { type: "Rumor", color: "#F97316" },
  { type: "Trust", color: "#F59E0B" },
];

export function GraphPanel({ graphData, dissolvingNodes, pulsatingEdges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [rumorEdgeOpacity, setRumorEdgeOpacity] = useState(1);
  const animRef = useRef<number | null>(null);

  // Pulsating animation for rumor edges
  useEffect(() => {
    let t = 0;
    function animate() {
      t += 0.05;
      setRumorEdgeOpacity(0.5 + 0.5 * Math.sin(t));
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeCanvasObject = useCallback(
    (rawNode: unknown, ctx: CanvasRenderingContext2D) => {
      const node = rawNode as GraphNode & { x?: number; y?: number };
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const nodeId = String(node.id ?? "");
      const isDissolving = dissolvingNodes.has(nodeId);
      const alpha = isDissolving ? 0.2 : 1;
      const nodeType = (node.nodeType as string) ?? "event";
      const radius = nodeType === "npc" ? 8 : nodeType === "player" ? 7 : 5;
      const color = NODE_TYPE_COLORS[nodeType] ?? "#64748B";

      ctx.save();
      ctx.globalAlpha = alpha;

      // Glow for NPC nodes
      if (nodeType === "npc") {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      const label = (node.label as string | undefined) ?? NODE_LABELS[nodeId] ?? nodeId.slice(0, 8);
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.shadowBlur = 0;
      ctx.fillText(label, x, y + radius + 2);

      ctx.restore();
    },
    [dissolvingNodes]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkCanvasObject = useCallback(
    (rawLink: unknown, ctx: CanvasRenderingContext2D) => {
      const link = rawLink as {
        source: unknown;
        target: unknown;
        edgeType?: string;
      };
      const srcNode = link.source as { x?: number; y?: number; id?: string };
      const tgtNode = link.target as { x?: number; y?: number; id?: string };
      if (!srcNode.x || !srcNode.y || !tgtNode.x || !tgtNode.y) return;

      const edgeType = link.edgeType ?? "event";
      const isRumor = edgeType === "rumor";
      const srcId = String(srcNode.id ?? "");
      const tgtId = String(tgtNode.id ?? "");
      const isPulsating = pulsatingEdges.some(
        (e) =>
          (e.from === srcId && e.to === tgtId) ||
          (e.from === tgtId && e.to === srcId)
      );

      const color = EDGE_TYPE_COLORS[edgeType] ?? "#64748B";
      const opacity = isRumor && isPulsating ? rumorEdgeOpacity : 0.5;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.moveTo(srcNode.x, srcNode.y);
      ctx.lineTo(tgtNode.x, tgtNode.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = isRumor ? 2 : 1;
      if (isRumor) ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    },
    [rumorEdgeOpacity, pulsatingEdges]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden rounded-lg border border-border">
        <ForceGraph2D
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#080B14"
          nodeCanvasObject={nodeCanvasObject}
          linkCanvasObject={linkCanvasObject}
          nodeRelSize={4}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          cooldownTicks={100}
          onEngineStop={() => {}}
        />
        {graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted font-mono text-xs text-center">
              No graph data yet.<br />
              Initialize world to seed knowledge graph.
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1">
        {LEGEND.map(({ type, color }) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] font-mono text-muted">{type}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-4 border-t border-orange-500 border-dashed" />
          <span className="text-[10px] font-mono text-orange-400">Rumor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 border-t border-green-500" />
          <span className="text-[10px] font-mono text-muted">Trust</span>
        </div>
      </div>
    </div>
  );
}
