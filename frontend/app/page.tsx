"use client";
// app/page.tsx — Full 3-panel Revenant layout

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGraph,
  getWorldState,
  getTrustTimeline,
  initWorld,
  sendDialogue,
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
  TrustHistoryEntry,
} from "@/lib/types";

const WORLD_NAME = "ashenvale";

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

export default function Home() {
  // World state
  const [worldId, setWorldId] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState<InitStatus>("idle");
  const [initError, setInitError] = useState<string | null>(null);
  const [gameDay, setGameDay] = useState(1);
  const [gold, setGold] = useState(200);

  // NPC state
  const [selectedNpc, setSelectedNpc] = useState<NpcId>("silas");
  const [trust, setTrust] = useState<Record<NpcId, number>>({
    silas: 50, elara: 65, kael: 40,
  });
  const [trajectories, setTrajectories] = useState<Record<NpcId, "RISING" | "STABLE" | "FALLING">>({
    silas: "STABLE", elara: "STABLE", kael: "STABLE",
  });
  const [histories, setHistories] = useState<Record<NpcId, TrustHistoryEntry[]>>({
    silas: [], elara: [], kael: [],
  });

  // Dialogue
  const [messages, setMessages] = useState<Record<NpcId, ChatMessage[]>>({
    silas: [], elara: [], kael: [],
  });
  const [isThinking, setIsThinking] = useState(false);

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
        const result = await initWorld(WORLD_NAME);
        setWorldId(result.world_id);

        // Fetch initial state
        const state = await getWorldState(result.world_id);
        setGameDay(state.game_day);
        setGold(state.gold);
        setTrust(state.trust as Record<NpcId, number>);
        state.npcs.forEach((npc) => {
          setTrajectories((prev) => ({ ...prev, [npc.id]: npc.trajectory }));
        });

        // Fetch initial trust histories
        for (const npcId of ["silas", "elara", "kael"] as NpcId[]) {
          const tl = await getTrustTimeline(npcId, result.world_id);
          setHistories((prev) => ({ ...prev, [npcId]: tl.history }));
        }

        // Fetch initial graph
        const graph = await getGraph(result.world_id);
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
      const tl = await getTrustTimeline(npcId, worldId);
      setHistories((prev) => ({ ...prev, [npcId]: tl.history }));
      setTrajectories((prev) => ({ ...prev, [npcId]: tl.trajectory }));
    }
  }, [worldId]);

  const handleGraphUpdated = useCallback((nodes: GraphNode[], edges: GraphLink[]) => {
    setGraphData({ nodes, links: edges });
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
    if (!worldId || isThinking) return;

    const playerMsg: ChatMessage = {
      id: `player-${Date.now()}`,
      sender: "player",
      text: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => ({
      ...prev,
      [selectedNpc]: [...prev[selectedNpc], playerMsg],
    }));
    setIsThinking(true);

    try {
      const result = await sendDialogue(selectedNpc, message, worldId);

      const npcMsg: ChatMessage = {
        id: `npc-${Date.now()}`,
        sender: selectedNpc,
        text: result.response,
        citations: result.citations,
        provenance_chain: result.provenance_chain ?? undefined,
        trust_delta: result.trust_delta,
        action: result.action,
        timestamp: Date.now(),
      };
      setMessages((prev) => ({
        ...prev,
        [selectedNpc]: [...prev[selectedNpc], npcMsg],
      }));

      setTrust((prev) => ({ ...prev, [selectedNpc]: result.new_trust }));

      // Refresh history
      const tl = await getTrustTimeline(selectedNpc, worldId);
      setHistories((prev) => ({ ...prev, [selectedNpc]: tl.history }));
      setTrajectories((prev) => ({ ...prev, [selectedNpc]: tl.trajectory }));

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Dialogue error: ${msg}`, "error");
    } finally {
      setIsThinking(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Rumor Mill
  // ---------------------------------------------------------------------------
  async function handleRumorMill() {
    if (!worldId || rumorLoading) return;
    setRumorLoading(true);
    try {
      const result = await triggerRumorMill(worldId);
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
      const result = await timeSkip(worldId, 1);
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
  function handleAmnesiaSuccess(documentId: string, goldRemaining: number) {
    setGold(goldRemaining);
    showToast(`Memory erased: ${documentId}. -50g.`, "success");
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Loading screen
  if (initStatus === "idle" || initStatus === "initializing") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 bg-base">
        <h1 className="font-display text-4xl text-accent header-glow tracking-widest">
          REVENANT
        </h1>
        <div className="flex items-center gap-3 text-muted text-sm font-mono">
          <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          Seeding knowledge graph...
        </div>
        <p className="text-xs text-muted/50 font-mono">
          Applying OWL ontology · Seeding NPC backstories · Initializing trust
        </p>
      </div>
    );
  }

  if (initStatus === "error") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-base px-8 text-center">
        <h1 className="font-display text-3xl text-danger">REVENANT</h1>
        <p className="text-danger font-mono text-sm">Failed to connect to backend</p>
        <pre className="text-xs text-muted bg-surface border border-border rounded-lg px-4 py-3 max-w-lg whitespace-pre-wrap">
          {initError}
        </pre>
        <p className="text-xs text-muted">
          Ensure <code className="text-accent font-mono">uvicorn backend.main:app --reload</code> is running
          and <code className="text-accent font-mono">.env</code> has your API keys.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-border bg-surface shrink-0">
        <h1 className="font-display text-xl text-accent header-glow tracking-[0.2em]">
          REVENANT
        </h1>
        <span className="text-border">|</span>
        <span className="text-xs font-mono text-muted">
          World: <span className="text-text">{worldId}</span>
        </span>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-muted">Day</span>
            <span className="text-accent2 font-bold text-sm">{gameDay}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-accent2">◈</span>
            <span className="text-accent2 font-bold">{gold}g</span>
          </div>
          <div className="text-[10px] font-mono text-muted border border-border rounded px-2 py-0.5">
            Cognee Cloud
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* 3-PANEL LAYOUT                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* LEFT: NPC Panel */}
        <div className="w-56 shrink-0 p-3 border-r border-border overflow-hidden">
          <NPCPanel
            npcs={npcPanelData}
            selectedNpc={selectedNpc}
            onSelect={setSelectedNpc}
          />
        </div>

        {/* CENTER: Dialogue Panel */}
        <div className="flex-1 min-w-0 border-r border-border flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <DialoguePanel
              npcId={selectedNpc}
              npcName={NPC_NAMES[selectedNpc]}
              messages={messages[selectedNpc]}
              isThinking={isThinking}
              onSend={handleSend}
            />
          </div>
        </div>

        {/* RIGHT: Graph Panel */}
        <div className="w-[400px] shrink-0 p-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted">
              Cognee Knowledge Graph
            </h2>
            <span className="text-[10px] font-mono text-accent/70 bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
              Live
            </span>
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

      {/* ------------------------------------------------------------------ */}
      {/* ENGINE CONTROLS                                                     */}
      {/* ------------------------------------------------------------------ */}
      <EngineControls
        worldId={worldId ?? ""}
        gold={gold}
        rumorLoading={rumorLoading}
        onTriggerRumorMill={handleRumorMill}
        onOpenAmnesia={() => setAmnesiaOpen(true)}
        onTimeSkip={handleTimeSkip}
        timeskipLoading={timeskipLoading}
      />

      {/* ------------------------------------------------------------------ */}
      {/* AMNESIA MODAL                                                       */}
      {/* ------------------------------------------------------------------ */}
      <AmnesiaModal
        isOpen={amnesiaOpen}
        npcId={selectedNpc}
        npcName={NPC_NAMES[selectedNpc]}
        worldId={worldId ?? ""}
        gold={gold}
        onClose={() => setAmnesiaOpen(false)}
        onSuccess={handleAmnesiaSuccess}
      />

      {/* ------------------------------------------------------------------ */}
      {/* TOAST                                                               */}
      {/* ------------------------------------------------------------------ */}
      {toast && (
        <div
          className={`
            fixed bottom-20 left-1/2 -translate-x-1/2 z-50
            px-4 py-2 rounded-lg border text-sm font-mono animate-slide-up
            ${
              toast.type === "error"
                ? "bg-red-950/90 border-danger text-danger"
                : toast.type === "success"
                ? "bg-green-950/90 border-green-700 text-green-300"
                : "bg-surface border-border text-muted"
            }
          `}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
