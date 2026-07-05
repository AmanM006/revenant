// lib/types.ts — Shared TypeScript types mirroring backend Pydantic schemas

export type NpcId = "silas" | "elara" | "kael";
export type ActionType = "betray" | "steal" | "help" | "pay" | "insult" | "compliment" | "bribe";
export type EntryType = "qa" | "skill_run" | "feedback" | "trace";
export type NpcAction = "none" | "warn_others" | "refuse_service" | "call_guard";
export type Trajectory = "RISING" | "STABLE" | "FALLING";
export type WsEventType =
  | "rumor_injected"
  | "node_dissolve"
  | "trust_update"
  | "graph_updated"
  | "day_advanced"
  | "improve_error"
  | "rumor_injected";

// ---------------------------------------------------------------------------
// NPC
// ---------------------------------------------------------------------------

export interface NpcInfo {
  id: NpcId;
  name: string;
  role: string;
  trust: number;
  trajectory: Trajectory;
}

export interface WorldStateSnapshot {
  world_id: string;
  game_day: number;
  gold: number;
  trust: Record<NpcId, number>;
  turn_counts: Record<NpcId, number>;
  npcs: NpcInfo[];
}

// ---------------------------------------------------------------------------
// Dialogue / Actions
// ---------------------------------------------------------------------------

export interface CitationEntry {
  document_id: string;
  type: EntryType;
  timestamp: string;
  content_preview: string;
  score: number;
}

export interface ProvenanceStep {
  step: number;
  document_id: string;
  type: string;
  content_preview: string;
  timestamp: string;
}

export interface DialogueResponse {
  response: string;
  trust_delta: number;
  new_trust: number;
  citations: CitationEntry[];
  action: NpcAction;
  turn_count: number;
  provenance_chain?: ProvenanceStep[];
}

export interface ActionResponse {
  new_trust: number;
  trust_history: TrustHistoryEntry[];
  message: string;
  action_type: ActionType;
  npc_id: NpcId;
}

// ---------------------------------------------------------------------------
// Trust timeline
// ---------------------------------------------------------------------------

export interface TrustHistoryEntry {
  day: number;
  score: number;
  event: string | null;
  delta: number;
}

export interface TrustResponse {
  npc_id: NpcId;
  current_trust: number;
  history: TrustHistoryEntry[];
  trajectory: Trajectory;
}

// ---------------------------------------------------------------------------
// Rumor Mill
// ---------------------------------------------------------------------------

export interface RumorMillResponse {
  status: string;
  rumors_propagated: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Memories / Amnesia
// ---------------------------------------------------------------------------

export interface MemoryDocument {
  document_id: string;
  description: string;
  type: EntryType;
  game_day: number | string;
  timestamp: string;
  content_preview: string;
}

export interface AmnesiaResponse {
  success: boolean;
  document_id_erased: string;
  gold_remaining: number;
  message: string;
  verified_deleted: boolean;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export type NodeType = "npc" | "player" | "rumor" | "trust" | "event";
export type EdgeType = "trust" | "rumor" | "event";

export interface GraphNode {
  id: string;
  label?: string;
  nodeType: NodeType;
  color: string;
  [key: string]: unknown;
}

export interface GraphLink {
  source: string;
  target: string;
  edgeType: EdgeType;
  color: string;
  label?: string;
  [key: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ---------------------------------------------------------------------------
// WebSocket events
// ---------------------------------------------------------------------------

export interface WsRumorInjected {
  type: "rumor_injected";
  from: NpcId;
  to: NpcId;
  label: string;
}

export interface WsNodeDissolve {
  type: "node_dissolve";
  document_id: string;
  npc_id: NpcId;
}

export interface WsTrustUpdate {
  type: "trust_update";
  npc_id: NpcId;
  score: number;
  reason: string;
}

export interface WsGraphUpdated {
  type: "graph_updated";
  nodes: GraphNode[];
  edges: GraphLink[];
}

export interface WsDayAdvanced {
  type: "day_advanced";
  game_day: number;
}

export type WsEvent =
  | WsRumorInjected
  | WsNodeDissolve
  | WsTrustUpdate
  | WsGraphUpdated
  | WsDayAdvanced;

// ---------------------------------------------------------------------------
// Chat messages (local UI state)
// ---------------------------------------------------------------------------

export type MessageSender = "player" | "system" | NpcId;

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  citations?: CitationEntry[];
  provenance_chain?: ProvenanceStep[];
  trust_delta?: number;
  action?: NpcAction;
  timestamp: number;
}
