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
  currentGameDay?: number;
}

export function GraphPanel({ graphData, dissolvingNodes, pulsatingEdges, currentGameDay = 1 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 360, height: 400 });
  const [showFlash, setShowFlash] = useState(false);
  const prevEdgesCount = useRef(pulsatingEdges.length);

  // Dissolve animation state
  const [dissolveTimes, setDissolveTimes] = useState<Record<string, number>>({});

  // Interactive Graph Intelligence States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | "all">("all");

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

  // ---------------------------------------------------------------------------
  // Graph Analytics & Filtering Calculations
  // ---------------------------------------------------------------------------

  // Calculate degree (connections count) for each node to find the key hub
  const degrees: Record<string, number> = {};
  graphData.links.forEach((l) => {
    const s = typeof l.source === "object" ? (l.source as any).id : l.source;
    const t = typeof l.target === "object" ? (l.target as any).id : l.target;
    if (s) degrees[s] = (degrees[s] || 0) + 1;
    if (t) degrees[t] = (degrees[t] || 0) + 1;
  });

  let maxNodeId = "";
  let maxCount = 0;
  Object.entries(degrees).forEach(([id, count]) => {
    // Exclude 'player' node to highlight NPC/concept interactions
    if (id !== "player" && count > maxCount) {
      maxCount = count;
      maxNodeId = id;
    }
  });

  const hubNode = graphData.nodes.find((n) => n.id === maxNodeId);
  const hubLabel = hubNode ? String(hubNode.label || hubNode.name || hubNode.id) : "None";

  // Filter nodes based on semantic search query and Day Timeline slider
  const filteredNodes = graphData.nodes.filter((node) => {
    // 1. Search filter matching name, label or ID
    const labelText = String(node.label || node.name || node.id || "");
    const matchesSearch =
      !searchQuery.trim() ||
      labelText.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Day timeline filter (only nodes created on or before selected day filter)
    let matchesDay = true;
    if (selectedDayFilter !== "all" && node.game_day !== undefined) {
      matchesDay = (node.game_day as number) <= (selectedDayFilter as number);
    }

    return matchesSearch && matchesDay;
  });

  // Filter links (only render links that connect two currently visible nodes)
  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredLinks = graphData.links.filter((link) => {
    const s = typeof link.source === "object" ? (link.source as any).id : link.source;
    const t = typeof link.target === "object" ? (link.target as any).id : link.target;
    return visibleNodeIds.has(s) && visibleNodeIds.has(t);
  });

  const processedGraph = {
    nodes: filteredNodes,
    links: filteredLinks,
  };

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

      // Search matching logic for highlight effects
      const isSearchActive = searchQuery.trim().length > 0;
      const matchesSearch =
        isSearchActive &&
        labelText.toLowerCase().includes(searchQuery.toLowerCase());

      // If search is active, dim all non-matching nodes to make the target stand out
      if (isSearchActive && !matchesSearch) {
        alpha *= 0.15;
      }

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

      // Draw search highlight ring (Gold glow)
      if (isSearchActive && matchesSearch) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

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
        ctx.fillStyle = isSearchActive && matchesSearch ? "#F59E0B" : "#E2E8F0";
        ctx.textAlign = "center";
        ctx.shadowBlur = 0;
        const namePart = labelText.split("_")[0]?.substring(0, 12) || "";
        ctx.fillText(namePart, x, y + radius + 10);
      }

      ctx.restore();
    },
    [dissolveTimes, searchQuery]
  );

  return (
    <div className="flex flex-col h-full bg-void rounded-xl border border-border p-3 overflow-hidden shadow-xl">
      
      {/* 📊 Graph Analytics Header */}
      <div className="mb-2.5 flex flex-col gap-2 border-b border-border/40 pb-2.5">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-semibold tracking-wider font-cinzel text-white uppercase">Graph Analytics</h3>
          <div className="flex items-center gap-2 text-[9px] font-mono text-secondary">
            <span>Nodes: <strong className="text-white">{filteredNodes.length}</strong></span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>Edges: <strong className="text-white">{filteredLinks.length}</strong></span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>Hub: <strong className="text-purple uppercase">{hubLabel}</strong></span>
          </div>
        </div>

        {/* 🔍 Semantic Memory Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search memory graph..."
            className="w-full bg-[#06080F] border border-border/60 rounded px-2.5 py-1 text-[11px] font-mono text-white placeholder-secondary focus:outline-none focus:border-purple/80"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1 text-secondary hover:text-white text-[11px] font-mono"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Graph Viewport Area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden rounded-lg bg-[#06080F]">
        <ForceGraph2D
          graphData={processedGraph}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#06080F"
          nodeCanvasObject={nodeCanvasObject}
          nodeRelSize={6}
          linkColor={(link: any) => {
            const l = link as GraphLink;
            if (l.edgeType === "rumor") return "rgba(239, 68, 68, 0.95)"; // bright red
            if (l.edgeType === "trust") return "rgba(34, 197, 94, 0.95)"; // bright green
            return "rgba(30, 42, 69, 0.8)"; // near-invisible default
          }}
          linkWidth={(link: any) => {
            const l = link as GraphLink;
            if (l.edgeType === "rumor") return 3.5;
            if (l.edgeType === "trust") return 2.5;
            return 1;
          }}
          linkLineDash={(link: any) => {
            const l = link as GraphLink;
            return l.edgeType === "rumor" ? [5, 3] : null;
          }}
          linkDirectionalParticles={(link: any) => {
            const l = link as GraphLink;
            return l.edgeType === "rumor" ? 6 : 0;
          }}
          linkDirectionalParticleColor={() => "rgba(239, 68, 68, 1)"}
          linkDirectionalParticleWidth={(link: any) => {
            const l = link as GraphLink;
            return l.edgeType === "rumor" ? 4 : 0;
          }}
          linkDirectionalParticleSpeed={0.008}
          cooldownTicks={100}
        />

        {/* Rumor Toast Notification */}
        <RumorToast visible={showFlash} onDismiss={() => setShowFlash(false)} />

        {filteredNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#06080F]/90">
            <p className="text-muted font-mono text-xs text-center">
              No matching graph nodes found.<br />
              Try adjusting the filters.
            </p>
          </div>
        )}
      </div>

      {/* ⏳ Time Travel slider (Timeline Snapshots) */}
      {currentGameDay > 1 && (
        <div className="mt-2.5 bg-[#06080F] border border-border/40 rounded p-2 flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-semibold text-white font-mono uppercase tracking-wider">⏳ Time Travel slider</span>
            <span className="text-[10px] font-mono text-purple">
              {selectedDayFilter === "all" ? "Showing: Current Day" : `Showing: Day ${selectedDayFilter}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max={currentGameDay}
              value={selectedDayFilter === "all" ? currentGameDay : selectedDayFilter}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSelectedDayFilter(val === currentGameDay ? "all" : val);
              }}
              className="flex-1 accent-purple h-1 bg-border rounded-lg appearance-none cursor-pointer"
            />
            <button
              onClick={() => setSelectedDayFilter("all")}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-border/40 transition ${
                selectedDayFilter === "all" ? "bg-purple text-white border-purple" : "bg-transparent text-secondary hover:text-white"
              }`}
            >
              Reset
            </button>
          </div>
        </div>
      )}

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
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="text-[10px] font-mono text-secondary">Rumor</span>
          </div>
        </div>
        <div className="flex gap-x-2.5 items-center">
          <div className="flex items-center gap-1">
            <span className="w-3 border-t border-[#22C55E] border-2" />
            <span className="text-[10px] font-mono text-secondary">Trust</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed border-[#EF4444] border-2" />
            <span className="text-[10px] font-mono text-secondary">Rumor</span>
          </div>
        </div>
      </div>

      {/* Call Log Panel */}
      <CallLogPanel />
    </div>
  );
}
