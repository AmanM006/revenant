// lib/api.ts — Typed API client for all backend endpoints

import type {
  ActionResponse,
  ActionType,
  AmnesiaResponse,
  DialogueResponse,
  GraphData,
  MemoryDocument,
  NpcId,
  RumorMillResponse,
  TrustResponse,
  WorldStateSnapshot,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Per-session world isolation
// Each browser tab gets a unique world_id stored in sessionStorage.
// This prevents multiple judges/testers from contaminating each other's state.
// ---------------------------------------------------------------------------

function getWorldId(): string {
  if (typeof window === "undefined") return "ashenvale_ssr";
  const stored = sessionStorage.getItem("revenant_world_id");
  if (stored) return stored;
  const id = `ashenvale_${Date.now().toString(36)}`;
  sessionStorage.setItem("revenant_world_id", id);
  return id;
}

export { getWorldId };

// ---------------------------------------------------------------------------
// Internal fetch helper — always logs errors, never throws silently
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export async function initWorld() {
  return apiFetch<{ world_id: string; dataset_id: string; status: string; npcs_seeded: string[] }>(
    "POST",
    "/world/init",
    { world_name: getWorldId() }
  );
}

export async function getWorldState(): Promise<WorldStateSnapshot> {
  return apiFetch<WorldStateSnapshot>("GET", `/world/${getWorldId()}/state`);
}

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

export async function sendDialogue(
  npcId: NpcId,
  message: string
): Promise<DialogueResponse> {
  return apiFetch<DialogueResponse>("POST", "/dialogue", {
    npc_id: npcId,
    message,
    world_id: getWorldId(),
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function sendAction(
  npcId: NpcId,
  actionType: ActionType
): Promise<ActionResponse> {
  return apiFetch<ActionResponse>("POST", "/action", {
    npc_id: npcId,
    action_type: actionType,
    world_id: getWorldId(),
  });
}

// ---------------------------------------------------------------------------
// Rumor Mill
// ---------------------------------------------------------------------------

export async function triggerRumorMill(): Promise<RumorMillResponse> {
  return apiFetch<RumorMillResponse>("POST", "/rumor-mill", { world_id: getWorldId() });
}

// ---------------------------------------------------------------------------
// Memories / Amnesia
// ---------------------------------------------------------------------------

export async function listMemories(npcId: NpcId): Promise<MemoryDocument[]> {
  return apiFetch<MemoryDocument[]>("GET", `/memories/${npcId}`, undefined, {
    world_id: getWorldId(),
  });
}

export async function forgetMemory(
  npcId: NpcId,
  documentId: string
): Promise<AmnesiaResponse> {
  return apiFetch<AmnesiaResponse>(
    "DELETE",
    `/memories/${npcId}/${encodeURIComponent(documentId)}`,
    undefined,
    { world_id: getWorldId() }
  );
}

// ---------------------------------------------------------------------------
// Trust timeline
// ---------------------------------------------------------------------------

export async function getTrustTimeline(npcId: NpcId): Promise<TrustResponse> {
  return apiFetch<TrustResponse>("GET", `/trust/${npcId}`, undefined, { world_id: getWorldId() });
}

// ---------------------------------------------------------------------------
// Time skip
// ---------------------------------------------------------------------------

export async function timeSkip(
  days = 1
): Promise<{ game_day: number; rumor_mill_triggered: boolean; gold: number }> {
  return apiFetch("POST", "/time-skip", { world_id: getWorldId(), days });
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export async function getGraph(): Promise<GraphData> {
  return apiFetch<GraphData>("GET", `/graph/${getWorldId()}`);
}

export async function checkHealth(): Promise<{ status: string }> {
  return apiFetch("GET", "/health");
}

export async function getSessionStats(npcId: NpcId): Promise<any> {
  return apiFetch("GET", `/session/${getWorldId()}/${npcId}`);
}

export async function verifyDialogue(
  npcId: NpcId,
  statement: string
): Promise<{ success: boolean; verdict: "true" | "false" | "unknown"; reason: string; gold_remaining: number }> {
  return apiFetch("POST", "/dialogue/verify", {
    npc_id: npcId,
    statement,
    world_id: getWorldId(),
  });
}

