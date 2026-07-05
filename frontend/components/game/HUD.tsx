"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useGameStore } from "./store"
import {
  initWorld, getWorldState, getGraph, getTrustTimeline,
  triggerRumorMill, timeSkip, getSessionStats, verifyDialogue
} from "@/lib/api"
import { useGameSocket } from "@/lib/useGameSocket"
import { AmnesiaModal } from "@/components/AmnesiaModal"
import { GraphPanel } from "@/components/GraphPanel"
import type { ChatMessage, GraphData, GraphLink, GraphNode, NpcId, NpcAction } from "@/lib/types"

const NPC_NAMES: Record<string, string> = { silas: "SILAS", elara: "ELARA", kael: "KAEL" }
const NPC_TITLES: Record<string, string> = { silas: "The Blacksmith", elara: "The Sorceress", kael: "The Guard Captain" }
const NPC_ICONS: Record<string, string> = { silas: "⚒", elara: "✦", kael: "⚔" }
const NPC_COLORS: Record<string, string> = { silas: "#f97316", elara: "#a78bfa", kael: "#60a5fa" }

type Toast = { msg: string; type: "info" | "success" | "error" }

export function HUD() {
  const { activeNpc } = useGameStore()

  // World
  const [worldId, setWorldId] = useState<string | null>(null)
  const [initDone, setInitDone] = useState(false)
  const [gameDay, setGameDay] = useState(1)
  const [gold, setGold] = useState(200)
  const [trust, setTrust] = useState<Record<string, number>>({ silas: 50, elara: 65, kael: 40 })

  // Dialogue — per NPC
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({ silas: [], elara: [], kael: [] })
  const [streaming, setStreaming] = useState<Record<string, string>>({ silas: "", elara: "", kael: "" })
  const [thinking, setThinking] = useState<Record<string, string>>({ silas: "", elara: "", kael: "" })
  const [loading, setLoading] = useState<Record<string, boolean>>({ silas: false, elara: false, kael: false })
  const abortRefs = useRef<Record<string, AbortController | null>>({ silas: null, elara: null, kael: null })
  const chatRef = useRef<HTMLDivElement>(null)

  // Input
  const [input, setInput] = useState("")
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)

  // Cognitive Diagnostics
  const [sessionDetails, setSessionDetails] = useState<any>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)

  async function handleDiagnosticsToggle() {
    if (!npc) return
    if (showDiagnostics) {
      setShowDiagnostics(false)
      return
    }
    setDiagLoading(true)
    try {
      const stats = await getSessionStats(npc)
      setSessionDetails(stats)
      setShowDiagnostics(true)
    } catch {
      showToast("Could not load Cognee session diagnostics.", "error")
    } finally {
      setDiagLoading(false)
    }
  }

  // Graph
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [dissolvingNodes, setDissolvingNodes] = useState<Set<string>>(new Set())
  const [pulsatingEdges, setPulsatingEdges] = useState<Array<{ from: string; to: string }>>([])

  // Actions
  const [rumorLoading, setRumorLoading] = useState(false)
  const [skipLoading, setSkipLoading] = useState(false)
  const [amnesiaOpen, setAmnesiaOpen] = useState(false)
  const [showGraph, setShowGraph] = useState(true)

  // Toast
  const [toast, setToast] = useState<Toast | null>(null)
  const toastRef = useRef<NodeJS.Timeout | null>(null)

  function showToast(msg: string, type: Toast["type"] = "info") {
    setToast({ msg, type })
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 4000)
  }

  // Day/night cycle in scene (cosmetic number only, real time from backend)
  const hourOfDay = ((gameDay - 1) % 3) === 0 ? "🌅 Dawn" : ((gameDay - 1) % 3) === 1 ? "☀️ Day" : "🌙 Night"

  // ── INIT ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const result = await initWorld()
        setWorldId(result.world_id)
        const state = await getWorldState()
        setGameDay(state.game_day)
        setGold(state.gold)
        setTrust(state.trust as Record<NpcId, number>)
        const graph = await getGraph()
        setGraphData(graph)
        setInitDone(true)
        showToast("⚔ Ashenvale loaded — knowledge graph seeded", "success")
      } catch {
        showToast("Backend offline. Start the server.", "error")
        setInitDone(true)
      }
    }
    init()
  }, [])

  // Graph polling if empty after init
  useEffect(() => {
    if (!initDone || graphData.nodes.length > 0 || !worldId) return
    let tries = 0
    const iv = setInterval(async () => {
      tries++
      try {
        const g = await getGraph()
        if (g.nodes.length > 0) { setGraphData(g); clearInterval(iv) }
      } catch {}
      if (tries >= 12) clearInterval(iv)
    }, 5000)
    return () => clearInterval(iv)
  }, [initDone, graphData.nodes.length, worldId])

  // ── WEBSOCKET ─────────────────────────────────────────────────────────────
  const handleRumorInjected = useCallback((from: NpcId, to: NpcId, label: string) => {
    setPulsatingEdges(p => [...p, { from, to }])
    showToast(`🌐 Rumor spread: ${label}`, "info")
    setTimeout(() => setPulsatingEdges(p => p.filter(e => !(e.from === from && e.to === to))), 8000)
  }, [])

  const handleNodeDissolve = useCallback((docId: string) => {
    setDissolvingNodes(p => {
      const next = new Set(p);
      next.add(docId);
      return next;
    });
    setTimeout(() => setDissolvingNodes(p => {
      const n = new Set(p);
      n.delete(docId);
      return n;
    }), 1200);
  }, []);

  const handleTrustUpdate = useCallback(async (npcId: NpcId, score: number) => {
    setTrust(p => ({ ...p, [npcId]: score }))
  }, [])

  const handleGraphUpdated = useCallback(() => {
    getGraph().then(g => setGraphData(g)).catch(() => {})
    showToast("Knowledge graph updated", "success")
  }, [])

  const handleDayAdvanced = useCallback((day: number) => setGameDay(day), [])

  useGameSocket(worldId, {
    onRumorInjected: handleRumorInjected,
    onNodeDissolve: handleNodeDissolve,
    onTrustUpdate: handleTrustUpdate,
    onGraphUpdated: handleGraphUpdated,
    onDayAdvanced: handleDayAdvanced,
  })

  // ── DIALOGUE STREAM ───────────────────────────────────────────────────────
  async function sendMessage() {
    if (!activeNpc || !input.trim() || loading[activeNpc] || !worldId) return
    const npc = activeNpc as NpcId
    const text = input.trim()
    setInput("")

    abortRefs.current[npc]?.abort()
    abortRefs.current[npc] = new AbortController()

    setLoading(p => ({ ...p, [npc]: true }))
    setThinking(p => ({ ...p, [npc]: "Querying memory graph..." }))
    setStreaming(p => ({ ...p, [npc]: "" }))

    const playerMsg: ChatMessage = { id: `p-${Date.now()}`, sender: "player", text, timestamp: Date.now() }
    setMessages(p => ({ ...p, [npc]: [...p[npc], playerMsg] }))

    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${BASE}/dialogue/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npc_id: npc, message: text, world_id: worldId }),
        signal: abortRefs.current[npc]!.signal,
      })

      if (!res.body) { showToast("No response body from server", "error"); return }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
      let finalText = ""
      let finalDelta = 0
      let finalAction = "none"

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n\n")
        buf = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === "status") {
              setThinking(p => ({ ...p, [npc]: data.label }))
            } else if (data.type === "chunk") {
              setStreaming(p => ({ ...p, [npc]: data.text }))
              setThinking(p => ({ ...p, [npc]: "" }))
            } else if (data.type === "done") {
              finalText = data.dialogue
              finalDelta = data.trust_delta
              finalAction = data.action
              const finalCitations = data.citations || []
              const finalProvenance = data.provenance_chain || []

              setStreaming(p => ({ ...p, [npc]: "" }))
              setThinking(p => ({ ...p, [npc]: "" }))
              const npcMsg: ChatMessage = {
                id: `n-${Date.now()}`,
                sender: npc,
                text: finalText,
                trust_delta: finalDelta,
                action: finalAction as NpcAction,
                citations: finalCitations,
                provenance_chain: finalProvenance,
                timestamp: Date.now()
              }
              setMessages(p => ({ ...p, [npc]: [...p[npc], npcMsg] }))
              setTrust(p => ({ ...p, [npc]: Math.max(0, Math.min(100, p[npc] + finalDelta)) }))
              // Refresh graph after each dialogue (Cognee updates knowledge)
              getGraph().then(g => setGraphData(g)).catch(() => {})
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        showToast(`Dialogue failed: ${e.message}`, "error")
      }
    } finally {
      setLoading(p => ({ ...p, [npc]: false }))
      setThinking(p => ({ ...p, [npc]: "" }))
      setStreaming(p => ({ ...p, [npc]: "" }))
    }
  }

  async function handleVerifyStatement() {
    if (!activeNpc || !input.trim() || loading[activeNpc] || !worldId) return
    const npc = activeNpc as NpcId
    const text = input.trim()
    setInput("")

    if (gold < 10) {
      showToast("Not enough gold to cast Zone of Truth (requires 10 Gold).", "error")
      return
    }

    setLoading(p => ({ ...p, [npc]: true }))
    setThinking(p => ({ ...p, [npc]: "Casting Zone of Truth..." }))

    // Add player verification request to the chat log
    const playerMsg: ChatMessage = {
      id: `p-${Date.now()}`,
      sender: "player",
      text: `🔮 [Zone of Truth] Check statement: "${text}"`,
      timestamp: Date.now()
    }
    setMessages(p => ({ ...p, [npc]: [...p[npc], playerMsg] }))

    try {
      const result = await verifyDialogue(npc, text)
      if (result.success) {
        setGold(result.gold_remaining)
        
        // Add verification outcome system message
        const systemMsg: ChatMessage = {
          id: `s-${Date.now()}`,
          sender: "system",
          text: `⚖️ Truth Verdict: ${result.verdict.toUpperCase()}\nExplanation: ${result.reason}`,
          timestamp: Date.now()
        }
        setMessages(p => ({ ...p, [npc]: [...p[npc], systemMsg] }))
        showToast(`Truth check complete: ${result.verdict.toUpperCase()}`, "success")
        
        // Refresh graph data
        const graph = await getGraph()
        setGraphData(graph)
      } else {
        showToast(result.reason || "Verification failed.", "error")
      }
    } catch (e: any) {
      showToast(e.message || "Failed to execute truth check.", "error")
    } finally {
      setLoading(p => ({ ...p, [npc]: false }))
      setThinking(p => ({ ...p, [npc]: "" }))
    }
  }

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [activeNpc, messages, streaming])

  // ── RUMOR MILL ────────────────────────────────────────────────────────────
  async function handleRumor() {
    if (!worldId || rumorLoading) return
    setRumorLoading(true)
    try {
      const r = await triggerRumorMill()
      showToast(`🌐 ${r.message}`, "info")
      getGraph().then(g => setGraphData(g)).catch(() => {})
    } catch (e: unknown) {
      showToast(`Rumor error: ${e instanceof Error ? e.message : ""}`, "error")
    } finally { setRumorLoading(false) }
  }

  // ── TIME SKIP ─────────────────────────────────────────────────────────────
  async function handleSkip() {
    if (!worldId || skipLoading) return
    setSkipLoading(true)
    try {
      const r = await timeSkip(1)
      setGameDay(r.game_day)
      setGold(r.gold)
      showToast(`📅 Day ${r.game_day}${r.rumor_mill_triggered ? " — Rumor Mill triggered!" : ""}`, "info")
    } catch (e: unknown) {
      showToast(`Time skip error: ${e instanceof Error ? e.message : ""}`, "error")
    } finally { setSkipLoading(false) }
  }

  const npc = activeNpc as NpcId | null
  const npcMessages = npc ? messages[npc] : []
  const npcStreaming = npc ? streaming[npc] : ""
  const npcThinking = npc ? thinking[npc] : ""
  const npcLoading = npc ? loading[npc] : false

  // RPG Reputation calculation
  const avgTrust = (trust.silas + trust.elara + trust.kael) / 3
  const repTitle = avgTrust > 65 ? "Hero" : avgTrust < 35 ? "Outlaw" : "Wanderer"
  const repColor = avgTrust > 65 ? "#22c55e" : avgTrust < 35 ? "#ef4444" : "#f59e0b"

  return (
    <div className="game-hud">

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <div className="hud-top">
        <div className="hud-title-wrap">
          <span className="hud-title">⚔ REVENANT</span>
          <span className="hud-subtitle">Ashenvale · {hourOfDay}</span>
        </div>

        {/* NPC trust meters */}
        <div className="hud-trust-row">
          {(["silas", "elara", "kael"] as const).map(id => (
            <div key={id} className={`hud-trust-item ${activeNpc === id ? "active" : ""}`}>
              <span className="hud-npc-icon" style={{ color: NPC_COLORS[id] }}>{NPC_ICONS[id]}</span>
              <div className="hud-trust-col">
                <span className="hud-npc-name">{id.toUpperCase()}</span>
                <div className="hud-trust-track">
                  <div className="hud-trust-fill" style={{
                    width: `${trust[id]}%`,
                    background: trust[id] > 60
                      ? "linear-gradient(90deg,#16a34a,#22c55e)"
                      : trust[id] > 30
                        ? "linear-gradient(90deg,#b45309,#f59e0b)"
                        : "linear-gradient(90deg,#b91c1c,#ef4444)"
                  }} />
                </div>
                <span className="hud-trust-num">{trust[id]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right controls */}
        <div className="hud-top-right">
          <div className="hud-gold" style={{ borderColor: repColor, color: repColor }} title="Average social reputation">
            🏆 {repTitle}
          </div>
          <div className="hud-gold">💰 {gold}g</div>
          <div className="hud-day">📅 Day {gameDay}</div>
          <button className="hud-action-btn" onClick={handleRumor} disabled={rumorLoading} title="Trigger Rumor Mill">
            {rumorLoading ? "⏳" : "🌐"} Rumor
          </button>
          <button className="hud-action-btn" onClick={handleSkip} disabled={skipLoading} title="Skip a day">
            {skipLoading ? "⏳" : "⏩"} Day+1
          </button>
          <button className="hud-action-btn hud-action-danger" onClick={() => setAmnesiaOpen(true)} title="Cast Amnesia">
            🫧 Amnesia
          </button>
          <button className="hud-action-btn" onClick={() => setShowGraph(x => !x)} title="Toggle graph">
            {showGraph ? "📊" : "📉"} Graph
          </button>
          <a href="/play" className="hud-switch-btn">📜 Full UI</a>
          <a href={`/view?world_id=${worldId}`} target="_blank" className="hud-switch-btn font-bold text-purple border-purple/60 hover:bg-purple/10">🕸️ View Graph</a>
        </div>
      </div>

      {/* ══ CONTROLS HINT ═══════════════════════════════════════════════════ */}
      {!activeNpc && (
        <div className="hud-controls">
          <span>🎮 WASD Move</span>
          <span>🖱 Right-drag Rotate</span>
          <span>🔍 Scroll Zoom</span>
          <span>⚔ Walk near NPC to speak</span>
        </div>
      )}

      {/* ══ DIALOGUE PANEL ══════════════════════════════════════════════════ */}
      {activeNpc && npc && (
        <div className="hud-dialogue">
          <div className="hud-dialogue-header">
            <span className="hud-dialogue-icon" style={{ color: NPC_COLORS[npc] }}>{NPC_ICONS[npc]}</span>
            <div>
              <div className="hud-dialogue-npc">{NPC_NAMES[npc]}</div>
              <div className="hud-dialogue-title">{NPC_TITLES[npc]}</div>
            </div>
            <div className="hud-dialogue-trust-badge" style={{
              background: trust[npc] > 60 ? "#16a34a" : trust[npc] > 30 ? "#b45309" : "#b91c1c"
            }}>
              ♥ Trust {trust[npc]}
            </div>
            <button
              className="hud-action-btn hud-action-danger pointer-events-auto"
              style={{ marginLeft: "auto" }}
              onClick={() => setAmnesiaOpen(true)}
              title="Erase this NPC's memory"
            >
              🫧 Amnesia
            </button>
            <button
              className="hud-action-btn pointer-events-auto"
              style={{ marginLeft: "8px" }}
              onClick={handleDiagnosticsToggle}
              disabled={diagLoading}
              title="Audit Cognee Cloud session telemetry"
            >
              🧠 {showDiagnostics ? "Hide Audit" : "Cloud Audit"}
            </button>
          </div>

          {/* Chat log */}
          <div className="hud-chat-log" ref={chatRef}>
            {/* Cognee Cloud Diagnostics Audit */}
            {showDiagnostics && sessionDetails && (
              <div className="hud-diagnostics-panel animate-fade-in pointer-events-auto">
                <div className="hud-diagnostics-header">🧠 Cognee Cloud Session Audit</div>
                <div className="hud-diag-grid">
                  <div className="hud-diag-item">
                    <span className="hud-diag-label">Session ID:</span>
                    <span className="hud-diag-val font-mono">{sessionDetails.session_id}</span>
                  </div>
                  <div className="hud-diag-item">
                    <span className="hud-diag-label">Active Model:</span>
                    <span className="hud-diag-val font-mono">{sessionDetails.last_model || "gemini-2.0-flash"}</span>
                  </div>
                  <div className="hud-diag-item">
                    <span className="hud-diag-label">Session Status:</span>
                    <span className="hud-diag-val" style={{ color: sessionDetails.status === "running" ? "#22c55e" : "#ef4444" }}>
                      ● {sessionDetails.status}
                    </span>
                  </div>
                  <div className="hud-diag-item">
                    <span className="hud-diag-label">Input Tokens:</span>
                    <span className="hud-diag-val">{sessionDetails.tokens_in || 0}</span>
                  </div>
                  <div className="hud-diag-item">
                    <span className="hud-diag-label">Output Tokens:</span>
                    <span className="hud-diag-val">{sessionDetails.tokens_out || 0}</span>
                  </div>
                  <div className="hud-diag-item">
                    <span className="hud-diag-label">Estimated Cost:</span>
                    <span className="hud-diag-val" style={{ color: "#fbbf24", fontWeight: "bold" }}>
                      ${(sessionDetails.cost_usd || 0).toFixed(6)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {npcMessages.length === 0 && !npcLoading && (
              <div className="hud-chat-empty">Walk up and speak to {NPC_NAMES[npc]}…</div>
            )}
            {npcMessages.map(msg => {
              const hasEvidence = (msg.citations && msg.citations.length > 0) || (msg.provenance_chain && msg.provenance_chain.length > 0)
              const isExpanded = expandedEvidence === msg.id

              return (
                <div key={msg.id} className="hud-chat-msg-container">
                  <div className={`hud-chat-msg ${msg.sender === "player" ? "player" : msg.sender === "system" ? "system" : "npc"}`}>
                    <span className="hud-chat-who">
                      {msg.sender === "player" ? "You" : msg.sender === "system" ? "⚖️ ZONE OF TRUTH" : NPC_NAMES[npc]}
                    </span>
                    <span className="hud-chat-text">{msg.text}</span>
                    {msg.trust_delta !== undefined && msg.trust_delta !== 0 && (
                      <span className={`hud-chat-delta ${msg.trust_delta > 0 ? "pos" : "neg"}`}>
                        {msg.trust_delta > 0 ? `▲ +${msg.trust_delta}` : `▼ ${msg.trust_delta}`}
                      </span>
                    )}
                    {msg.action && msg.action !== "none" && (
                      <span className="hud-chat-action">[{msg.action}]</span>
                    )}
                    {hasEvidence && (
                      <button
                        className="hud-evidence-toggle pointer-events-auto"
                        onClick={() => setExpandedEvidence(isExpanded ? null : msg.id)}
                      >
                        {isExpanded ? "▼ Hide Source" : "📎 Source"}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="hud-evidence-panel animate-fade-in pointer-events-auto">
                      {msg.provenance_chain && msg.provenance_chain.length > 0 && (
                        <div className="hud-prov-section">
                          <div className="hud-evidence-header">⛓ Provenance Path</div>
                          <div className="hud-prov-steps">
                            {msg.provenance_chain.map((step: { step: number; type: string; content_preview: string }, idx: number) => (
                              <div key={idx} className="hud-prov-step">
                                <span className="hud-step-num">#{step.step}</span>
                                <span className="hud-step-type">{step.type}</span>
                                <p className="hud-step-desc">&quot;{step.content_preview}&quot;</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="hud-cite-section">
                          <div className="hud-evidence-header">📖 Recall References (Cognee Chunks)</div>
                          <div className="hud-cite-grid">
                            {msg.citations.slice(0, 3).map((cite: { type: string; source_document?: string; content_preview: string }, idx: number) => (
                              <div key={idx} className="hud-cite-card">
                                <div className="hud-cite-meta">
                                  <span className="hud-cite-type">{cite.type}</span>
                                  {cite.source_document && (
                                    <span className="hud-cite-source">{cite.source_document}</span>
                                  )}
                                </div>
                                <p className="hud-cite-text">&quot;{cite.content_preview}&quot;</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {/* Thinking indicator */}
            {npcThinking && (
              <div className="hud-chat-msg npc">
                <span className="hud-chat-who">{NPC_NAMES[npc]}</span>
                <span className="hud-chat-thinking">⟳ {npcThinking}</span>
              </div>
            )}
            {/* Streaming text */}
            {npcStreaming && (
              <div className="hud-chat-msg npc">
                <span className="hud-chat-who">{NPC_NAMES[npc]}</span>
                <span className="hud-chat-text">{npcStreaming}<span className="hud-cursor">▌</span></span>
              </div>
            )}
          </div>

          {/* Quick replies */}
          <div className="hud-quick-actions">
            {["Who do you know here?", "Do you trust me?", "Tell me a secret.", "What do you know about the player?"].map(q => (
              <button key={q} className="hud-quick-btn" onClick={() => setInput(q)}>
                💬 {q}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div className="hud-dialogue-input-row">
            <input
              className="hud-dialogue-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={`Speak to ${NPC_NAMES[npc]}…`}
              autoFocus
            />
            <button className="hud-dialogue-send" onClick={sendMessage} disabled={npcLoading}>
              {npcLoading ? "⏳" : "Send ➤"}
            </button>
            <button
              className="hud-dialogue-send pointer-events-auto"
              style={{ borderColor: "#fbbf24", color: "#fbbf24", minWidth: "100px", background: "rgba(124, 45, 18, 0.2)" }}
              onClick={handleVerifyStatement}
              disabled={npcLoading || !input.trim()}
              title="Cast Zone of Truth check (Costs 10 Gold)"
            >
              ⚖️ Truth (10g)
            </button>
          </div>
        </div>
      )}

      {/* ══ GRAPH PANEL (right side) ═════════════════════════════════════════ */}
      {showGraph && (
        <div className="hud-graph-panel">
          <div className="hud-graph-title">
            <span>🕸 Knowledge Graph</span>
            <span className="hud-graph-count">{graphData.nodes.length} nodes</span>
          </div>
          <div className="hud-graph-body">
            <GraphPanel
              graphData={graphData}
              dissolvingNodes={dissolvingNodes}
              pulsatingEdges={pulsatingEdges}
              currentGameDay={gameDay}
            />
          </div>
        </div>
      )}

      {/* ══ MINIMAP ══════════════════════════════════════════════════════════ */}
      {!showGraph && (
        <div className="hud-minimap">
          <div className="hud-minimap-title">📍 Ashenvale</div>
          <div className="hud-minimap-canvas">
            <div className="mm-npc" style={{ left: "20%", top: "20%", background: "#f97316" }} title="Silas" />
            <div className="mm-npc" style={{ left: "75%", top: "75%", background: "#a78bfa" }} title="Elara" />
            <div className="mm-npc" style={{ left: "20%", top: "75%", background: "#60a5fa" }} title="Kael" />
            <div className="mm-player" />
          </div>
        </div>
      )}

      {/* ══ TOAST ════════════════════════════════════════════════════════════ */}
      {toast && (
        <div className={`hud-toast hud-toast-${toast.type}`}>
          {toast.msg}
        </div>
      )}

      {/* ══ AMNESIA MODAL ════════════════════════════════════════════════════ */}
      {amnesiaOpen && npc && (
        <AmnesiaModal
          isOpen={amnesiaOpen}
          npcId={npc}
          npcName={NPC_NAMES[npc]}
          gold={gold}
          onClose={() => setAmnesiaOpen(false)}
          onSuccess={(docId, goldLeft, verified) => {
            setGold(goldLeft)
            setAmnesiaOpen(false)
            showToast(verified ? "✓ Memory erased & verified" : "Memory erased (processing…)", "success")
          }}
        />
      )}
    </div>
  )
}
