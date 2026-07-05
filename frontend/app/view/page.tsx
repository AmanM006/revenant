"use client";

import { useEffect, useState, useCallback } from "react";
import { getGraph, getWorldId } from "@/lib/api";
import { GraphPanel } from "@/components/GraphPanel";
import { useGameSocket } from "@/lib/useGameSocket";
import type { GraphData, GraphNode, GraphLink } from "@/lib/types";

export default function ViewPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [dissolvingNodes, setDissolvingNodes] = useState<Set<string>>(new Set());
  const [pulsatingEdges, setPulsatingEdges] = useState<Array<{ from: string; to: string }>>([]);
  const [gameDay, setGameDay] = useState(1);
  const [worldId, setWorldId] = useState<string | null>(null);

  // Initialize worldId from query params or sessionStorage on client load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("world_id");
    if (queryId) {
      sessionStorage.setItem("revenant_world_id", queryId);
      setWorldId(queryId);
    } else {
      setWorldId(getWorldId());
    }
  }, []);

  const fetchGraph = useCallback(async () => {
    try {
      const g = await getGraph();
      setGraphData(g);
    } catch (err) {
      console.error("Failed to fetch graph:", err);
    }
  }, []);

  useEffect(() => {
    if (worldId) {
      fetchGraph();
    }
  }, [worldId, fetchGraph]);

  const handleRumorInjected = useCallback((from: string, to: string) => {
    setPulsatingEdges((prev) => [...prev, { from, to }]);
    setTimeout(() => {
      setPulsatingEdges((prev) => prev.filter((e) => !(e.from === from && e.to === to)));
    }, 8000);
  }, []);

  const handleNodeDissolve = useCallback((docId: string) => {
    setDissolvingNodes((prev) => {
      const next = new Set(prev);
      next.add(docId);
      return next;
    });
    setTimeout(() => {
      setDissolvingNodes((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }, 1200);
  }, []);

  const handleGraphUpdated = useCallback(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleDayAdvanced = useCallback((day: number) => {
    setGameDay(day);
  }, []);

  useGameSocket(worldId, {
    onRumorInjected: handleRumorInjected,
    onNodeDissolve: handleNodeDissolve,
    onGraphUpdated: handleGraphUpdated,
    onDayAdvanced: handleDayAdvanced,
  });

  return (
    <div className="w-screen h-screen bg-[#02040A] flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Header bar */}
      <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-xl font-bold font-cinzel text-white uppercase tracking-wider flex items-center gap-2">
            🕸️ Revenant World Intelligence
          </h1>
          <p className="text-xs font-mono text-secondary mt-1">
            Active Dataset: <strong className="text-white uppercase">{worldId || "Loading..."}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3 bg-[#06080F] border border-border/60 rounded px-3 py-1.5 font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span className="text-secondary">SYSTEM STATE:</span>
          <span className="text-white font-bold uppercase">LIVE MONITOR</span>
          <span className="text-border">|</span>
          <span className="text-secondary">GAME DAY:</span>
          <span className="text-purple font-bold">DAY {gameDay}</span>
        </div>
      </div>

      {/* Full screen GraphPanel viewport */}
      <div className="flex-1 min-h-0 bg-[#06080F] rounded-xl border border-border overflow-hidden shadow-2xl">
        <GraphPanel
          graphData={graphData}
          dissolvingNodes={dissolvingNodes}
          pulsatingEdges={pulsatingEdges}
          currentGameDay={gameDay}
        />
      </div>
    </div>
  );
}
