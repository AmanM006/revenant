"use client";
// app/play/page.tsx — Overhauled 3-panel gameplay interface

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGraph,
  getWorldState,
  getTrustTimeline,
  initWorld,
  timeSkip,
  triggerRumorMill,
} from "@/lib/api";
import { useGameSocket } from "@/lib/useGameSocket";
import { AmnesiaModal } from "@/components/AmnesiaModal";
import { DialoguePanel } from "@/components/DialoguePanel";
import { EngineControls } from "@/components/EngineControls";
import { GraphPanel } from "@/components/GraphPanel";
import { NPCPanel } from "@/components/NPCPanel";
import type {
  ChatMessage,
  GraphData,
  GraphLink,
  GraphNode,
  NpcId,
  NpcAction,
  TrustHistoryEntry,
} from "@/lib/types";

const NPC_NAMES: Record<NpcId, string> = {
  silas: "Silas",
  elara: "Elara",
  kael: "Kael",
};

const NPC_ROLES: Record<NpcId, string> = {
  silas: "Blacksmith",
  elara: "Mage",
  kael: "Guard Captain",
};

type InitStatus = "idle" | "initializing" | "ready" | "error";

export default function PlayPage() {
  // World state
  const [worldId, setWorldId] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState<InitStatus>("idle");
  const [initError, setInitError] = useState<string | null>(null);
  const [gameDay, setGameDay] = useState(1);
  const [gold, setGold] = useState(200);

  // NPC state
  const [selectedNpc, setSelectedNpc] = useState<NpcId>("silas");
  const [trust, setTrust] = useState<Record<NpcId, number>>({
    silas: 50,
    elara: 65,
    kael: 40,
  });
  const [trajectories, setTrajectories] = useState<Record<NpcId, "RISING" | "STABLE" | "FALLING">>({
    silas: "STABLE",
    elara: "STABLE",
    kael: "STABLE",
  });
  const [histories, setHistories] = useState<Record<NpcId, TrustHistoryEntry[]>>({
    silas: [],
    elara: [],
    kael: [],
  });

  // Dialogue
  const [messages, setMessages] = useState<Record<NpcId, ChatMessage[]>>({
    silas: [],
    elara: [],
    kael: [],
  });
  const [isThinking, setIsThinking] = useState<Record<NpcId, boolean>>({
    silas: false,
    elara: false,
    kael: false,
  });
  const [loadingNpcs, setLoadingNpcs] = useState<Record<NpcId, boolean>>({
    silas: false,
    elara: false,
    kael: false,
  });
  const [streamingText, setStreamingText] = useState<Record<NpcId, string>>({
    silas: "",
    elara: "",
    kael: "",
  });
  const [thinkingStep, setThinkingStep] = useState<Record<NpcId, string>>({
    silas: "",
    elara: "",
    kael: "",
  });
  const abortControllersRef = useRef<Record<NpcId, AbortController | null>>({
    silas: null,
    elara: null,
    kael: null,
  });

  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      // Cancel in-flight streams on unmount
      Object.values(controllers).forEach((ac) => ac?.abort());
    };
  }, []);

  // Graph
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [dissolvingNodes, setDissolvingNodes] = useState<Set<string>>(new Set());
  const [pulsatingEdges, setPulsatingEdges] = useState<Array<{ from: string; to: string }>>([]);

  // Engine controls
  const [rumorLoading, setRumorLoading] = useState(false);
  const [timeskipLoading, setTimeskipLoading] = useState(false);
  const [amnesiaOpen, setAmnesiaOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "info" | "success" | "error" } | null>(null);
  const toastTimeout = useRef<NodeJS.Timeout | null>(null);

  function showToast(msg: string, type: "info" | "success" | "error" = "info") {
    setToast({ msg, type });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  }

  // ---------------------------------------------------------------------------
  // World initialization
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      setInitStatus("initializing");
      try {
        const result = await initWorld();
        setWorldId(result.world_id);

        // Fetch initial state
        const state = await getWorldState();
        setGameDay(state.game_day);
        setGold(state.gold);
        setTrust(state.trust as Record<NpcId, number>);
        state.npcs.forEach((npc) => {
          setTrajectories((prev) => ({ ...prev, [npc.id]: npc.trajectory }));
        });

        // Fetch initial trust histories
        for (const npcId of ["silas", "elara", "kael"] as NpcId[]) {
          const tl = await getTrustTimeline(npcId);
          setHistories((prev) => ({ ...prev, [npcId]: tl.history }));
        }

        // Fetch initial graph
        const graph = await getGraph();
        setGraphData(graph);

        setInitStatus("ready");
        showToast("World initialized. The knowledge graph is seeded.", "success");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setInitError(msg);
        setInitStatus("error");
      }
    }
    init();
  }, []);

  // ---------------------------------------------------------------------------
  // Graph Self-Healing Poll
  // Cognee Cloud graph indexing is async and has a propagation delay.
  // The initial getGraph() call may return 0 nodes if the graph is still writing.
  // We poll every 5s until nodes are returned, then clear the interval.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (initStatus !== "ready" || graphData.nodes.length > 0 || !worldId) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const graph = await getGraph();
        if (graph.nodes && graph.nodes.length > 0) {
          setGraphData(graph);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error polling graph:", err);
      }
      if (attempts >= 12) {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [initStatus, graphData.nodes.length, worldId]);

  // ---------------------------------------------------------------------------
  // WebSocket handlers
  // ---------------------------------------------------------------------------
  const handleRumorInjected = useCallback((from: NpcId, to: NpcId, label: string) => {
    setPulsatingEdges((prev) => [...prev, { from, to }]);
    showToast(`🌐 Rumor: ${label}`, "info");
    setTimeout(() => {
      setPulsatingEdges((prev) => prev.filter((e) => !(e.from === from && e.to === to)));
    }, 8000);
  }, []);

  const handleNodeDissolve = useCallback((documentId: string) => {
    setDissolvingNodes((prev) => new Set(Array.from(prev).concat(documentId)));
    setTimeout(() => {
      setDissolvingNodes((prev) => {
        const next = new Set(Array.from(prev));
        next.delete(documentId);
        return next;
      });
    }, 1200);
  }, []);

  const handleTrustUpdate = useCallback(async (npcId: NpcId, score: number) => {
    setTrust((prev) => ({ ...prev, [npcId]: score }));
    if (worldId) {
      const tl = await getTrustTimeline(npcId);
      setHistories((prev) => ({ ...prev, [npcId]: tl.history }));
      setTrajectories((prev) => ({ ...prev, [npcId]: tl.trajectory }));
    }
  }, [worldId]);

  const handleGraphUpdated = useCallback(() => {
    getGraph().then(g => setGraphData(g)).catch(() => {});
    showToast("Knowledge graph updated by improve().", "success");
  }, []);

  const handleDayAdvanced = useCallback((day: number) => {
    setGameDay(day);
  }, []);

  useGameSocket(worldId, {
    onRumorInjected: handleRumorInjected,
    onNodeDissolve: handleNodeDissolve,
    onTrustUpdate: handleTrustUpdate,
    onGraphUpdated: handleGraphUpdated,
    onDayAdvanced: handleDayAdvanced,
  });

  // ---------------------------------------------------------------------------
  // Dialogue
  // ---------------------------------------------------------------------------
  async function handleSend(message: string) {
    if (!worldId) return;

    const activeNpc = selectedNpc;

    // Cancel any in-flight request for this specific NPC
    abortControllersRef.current[activeNpc]?.abort();
    abortControllersRef.current[activeNpc] = new AbortController();

    setLoadingNpcs((prev) => ({ ...prev, [activeNpc]: true }));
    setIsThinking((prev) => ({ ...prev, [activeNpc]: true }));
    setThinkingStep((prev) => ({ ...prev, [activeNpc]: "Querying memory graph..." }));
    setStreamingText((prev) => ({ ...prev, [activeNpc]: "" }));

    const playerMsg: ChatMessage = {
      id: `player-${Date.now()}`,
      sender: "player",
      text: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => ({
      ...prev,
      [activeNpc]: [...prev[activeNpc], playerMsg],
    }));

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/dialogue/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npc_id: activeNpc, message, world_id: worldId }),
        signal: abortControllersRef.current[activeNpc]!.signal,
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalDialogue = "";
      let finalDelta = 0;
      let finalAction = "none";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "status") {
              setThinkingStep((prev) => ({ ...prev, [activeNpc]: data.label }));
            } else if (data.type === "chunk") {
              setStreamingText((prev) => ({ ...prev, [activeNpc]: data.text }));
              setIsThinking((prev) => ({ ...prev, [activeNpc]: false }));
            } else if (data.type === "done") {
              finalDialogue = data.dialogue;
              finalDelta = data.trust_delta;
              finalAction = data.action;
              setStreamingText((prev) => ({ ...prev, [activeNpc]: "" }));
              setIsThinking((prev) => ({ ...prev, [activeNpc]: false }));

              const npcMsg: ChatMessage = {
                id: `npc-${Date.now()}`,
                sender: activeNpc,
                text: finalDialogue,
                trust_delta: finalDelta,
                action: finalAction as NpcAction,
                timestamp: Date.now(),
              };
              setMessages((prev) => ({
                ...prev,
                [activeNpc]: [...prev[activeNpc], npcMsg],
              }));

              setTrust((prev) => {
                const nextScore = Math.max(0, Math.min(100, prev[activeNpc] + finalDelta));
                return { ...prev, [activeNpc]: nextScore };
              });

              // Refresh histories
              getTrustTimeline(activeNpc).then((tl) => {
                setHistories((prev) => ({ ...prev, [activeNpc]: tl.history }));
                setTrajectories((prev) => ({ ...prev, [activeNpc]: tl.trajectory }));
              });
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        showToast(`Dialogue error: ${err.message}`, "error");
      }
    } finally {
      setIsThinking((prev) => ({ ...prev, [activeNpc]: false }));
      setLoadingNpcs((prev) => ({ ...prev, [activeNpc]: false }));
      setStreamingText((prev) => ({ ...prev, [activeNpc]: "" }));
    }
  }

  // ---------------------------------------------------------------------------
  // Rumor Mill
  // ---------------------------------------------------------------------------
  async function handleRumorMill() {
    if (!worldId || rumorLoading) return;
    setRumorLoading(true);
    try {
      const result = await triggerRumorMill();
      showToast(`${result.message}`, "info");
    } catch (e: unknown) {
      showToast(`Rumor mill error: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setRumorLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Time Skip
  // ---------------------------------------------------------------------------
  async function handleTimeSkip() {
    if (!worldId || timeskipLoading) return;
    setTimeskipLoading(true);
    try {
      const result = await timeSkip(1);
      setGameDay(result.game_day);
      setGold(result.gold);
      showToast(
        `Day ${result.game_day}${result.rumor_mill_triggered ? " — Rumor Mill triggered!" : ""}`,
        "info"
      );
    } catch (e: unknown) {
      showToast(`Time skip error: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setTimeskipLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Amnesia success
  // ---------------------------------------------------------------------------
  function handleAmnesiaSuccess(documentId: string, goldRemaining: number, verifiedDeleted: boolean) {
    setGold(goldRemaining);
    if (verifiedDeleted) {
      showToast("✓ Memory erased and verified gone from graph", "success");
    } else {
      showToast("Memory erased. Cognee Cloud processing deletion...", "success");
    }
  }

  // ---------------------------------------------------------------------------
  // NPC panel data
  // ---------------------------------------------------------------------------
  const npcPanelData = (["silas", "elara", "kael"] as NpcId[]).map((id) => ({
    id,
    name: NPC_NAMES[id],
    role: NPC_ROLES[id],
    trust: trust[id],
    trajectory: trajectories[id],
    history: histories[id],
  }));

  // Loading screen
  if (initStatus === "idle" || initStatus === "initializing") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 bg-void relative overflow-hidden">
        {/* Animated backgrounds */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-purple/10 blur-[100px] float-particle" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-amber/5 blur-[100px] float-particle [animation-delay:2s]" />

        <h1 className="font-decorative text-4xl text-purple-glow header-glow tracking-widest uppercase">
          REVENANT
        </h1>
        <div className="flex items-center gap-3 text-secondary text-sm font-mono">
          <span className="w-4 h-4 border-2 border-purple/30 border-t-purple rounded-full animate-spin" />
          Seeding knowledge graph...
        </div>
        <p className="text-xs text-muted font-mono max-w-sm text-center leading-relaxed">
          Applying OWL ontology · Seeding NPC backstories · Grounding trust vectors
        </p>
      </div>
    );
  }

  if (initStatus === "error") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-void px-8 text-center">
        <h1 className="font-decorative text-3xl text-red header-glow tracking-wider uppercase">
          REVENANT
        </h1>
        <p className="text-red font-mono text-sm uppercase tracking-widest">
          Engine Connection Failed
        </p>
        <pre className="text-xs text-secondary bg-surface border border-border rounded-lg px-4 py-3 max-w-lg whitespace-pre-wrap font-mono">
          {initError}
        </pre>
        <p className="text-xs text-muted max-w-md leading-relaxed font-body">
          Ensure uvicorn is running, your Cognee Cloud tenant is active, and keys are correctly configured.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-void overflow-hidden font-body text-primary">
      {/* Topbar Header */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-border bg-surface shrink-0 z-10" style={{ zoom: 0.8 }}>
        <h1 className="font-decorative text-lg text-purple-glow header-glow tracking-[0.15em] uppercase">
          REVENANT
        </h1>
        <span className="text-border">|</span>
        <span className="text-xs font-mono text-muted">
          World: <span className="text-primary">{worldId}</span>
        </span>

        <div className="ml-auto flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-muted">Day</span>
            <span className="text-amber font-bold text-sm">{gameDay}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-amber">◆</span>
            <span className="text-amber font-bold">{gold}g</span>
          </div>
          <Link
            href="/world"
            className="text-[10px] font-mono text-amber border border-amber/40 hover:border-amber rounded px-2.5 py-0.5 transition-all duration-200"
          >
            🎮 3D World
          </Link>
          <a
            href="https://cognee.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-muted border border-border rounded px-2.5 py-0.5 hover:text-purple-glow hover:border-purple transition-all duration-200"
          >
            Cognee Cloud ↗
          </a>
        </div>
      </header>

      {/* 3-Panel Layout */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* LEFT: NPC panel */}
        <div className="w-[350px] shrink-0 p-3 border-r border-border overflow-hidden bg-void" style={{ zoom: 0.8 }}>
          <NPCPanel
            npcs={npcPanelData}
            selectedNpc={selectedNpc}
            loadingNpcs={loadingNpcs}
            onSelect={setSelectedNpc}
          />
        </div>

        {/* CENTER: Dialogue panel */}
        <div className="flex-1 min-w-0 border-r border-border flex flex-col overflow-hidden p-3 bg-void" style={{ zoom: 0.8 }}>
          <DialoguePanel
            npcId={selectedNpc}
            npcName={NPC_NAMES[selectedNpc]}
            messages={messages[selectedNpc]}
            trust={trust[selectedNpc]}
            isThinking={isThinking[selectedNpc]}
            thinkingStep={thinkingStep[selectedNpc]}
            streamingText={streamingText[selectedNpc]}
            onSend={handleSend}
          />
        </div>

        {/* RIGHT: Graph panel */}
        <div className="w-[360px] shrink-0 p-3 flex flex-col overflow-hidden bg-void">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-[11px] font-display font-semibold uppercase tracking-[0.2em] text-muted">
              Cognee Knowledge Graph
            </h2>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
              <span className="text-[9px] font-mono text-green uppercase tracking-wider font-semibold">
                Live
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <GraphPanel
              graphData={graphData}
              dissolvingNodes={dissolvingNodes}
              pulsatingEdges={pulsatingEdges}
            />
          </div>
        </div>
      </div>

      {/* Engine Action Controls */}
      <div style={{ zoom: 0.8 }}>
        <EngineControls
          gold={gold}
          rumorLoading={rumorLoading}
          onTriggerRumorMill={handleRumorMill}
          onOpenAmnesia={() => setAmnesiaOpen(true)}
          onTimeSkip={handleTimeSkip}
          timeskipLoading={timeskipLoading}
        />
      </div>

      {/* Amnesia modal */}
      <AmnesiaModal
        isOpen={amnesiaOpen}
        npcId={selectedNpc}
        npcName={NPC_NAMES[selectedNpc]}
        gold={gold}
        onClose={() => setAmnesiaOpen(false)}
        onSuccess={handleAmnesiaSuccess}
      />

      {/* Toast Message */}
      {toast && (
        <div
          className={`
            fixed bottom-20 left-1/2 -translate-x-1/2 z-50
            px-4 py-2.5 rounded-lg border text-xs font-mono animate-slide-up shadow-xl
            ${
              toast.type === "error"
                ? "bg-red-950/90 border-red text-red shadow-red/10"
                : toast.type === "success"
                ? "bg-green/10 border-green text-green shadow-green/10"
                : "bg-surface border-border text-secondary"
            }
          `}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
