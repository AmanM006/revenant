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

export async function initWorld(worldName: string) {
  return apiFetch<{ world_id: string; dataset_id: string; status: string; npcs_seeded: string[] }>(
    "POST",
    "/world/init",
    { world_name: worldName }
  );
}

export async function getWorldState(worldId: string): Promise<WorldStateSnapshot> {
  return apiFetch<WorldStateSnapshot>("GET", `/world/${worldId}/state`);
}

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

export async function sendDialogue(
  npcId: NpcId,
  message: string,
  worldId: string
): Promise<DialogueResponse> {
  return apiFetch<DialogueResponse>("POST", "/dialogue", {
    npc_id: npcId,
    message,
    world_id: worldId,
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function sendAction(
  npcId: NpcId,
  actionType: ActionType,
  worldId: string
): Promise<ActionResponse> {
  return apiFetch<ActionResponse>("POST", "/action", {
    npc_id: npcId,
    action_type: actionType,
    world_id: worldId,
  });
}

// ---------------------------------------------------------------------------
// Rumor Mill
// ---------------------------------------------------------------------------

export async function triggerRumorMill(worldId: string): Promise<RumorMillResponse> {
  return apiFetch<RumorMillResponse>("POST", "/rumor-mill", { world_id: worldId });
}

// ---------------------------------------------------------------------------
// Memories / Amnesia
// ---------------------------------------------------------------------------

export async function listMemories(npcId: NpcId, worldId: string): Promise<MemoryDocument[]> {
  return apiFetch<MemoryDocument[]>("GET", `/memories/${npcId}`, undefined, {
    world_id: worldId,
  });
}

export async function forgetMemory(
  npcId: NpcId,
  documentId: string,
  worldId: string
): Promise<AmnesiaResponse> {
  return apiFetch<AmnesiaResponse>(
    "DELETE",
    `/memories/${npcId}/${encodeURIComponent(documentId)}`,
    undefined,
    { world_id: worldId }
  );
}

// ---------------------------------------------------------------------------
// Trust timeline
// ---------------------------------------------------------------------------

export async function getTrustTimeline(npcId: NpcId, worldId: string): Promise<TrustResponse> {
  return apiFetch<TrustResponse>("GET", `/trust/${npcId}`, undefined, { world_id: worldId });
}

// ---------------------------------------------------------------------------
// Time skip
// ---------------------------------------------------------------------------

export async function timeSkip(
  worldId: string,
  days = 1
): Promise<{ game_day: number; rumor_mill_triggered: boolean; gold: number }> {
  return apiFetch("POST", "/time-skip", { world_id: worldId, days });
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export async function getGraph(worldId: string): Promise<GraphData> {
  return apiFetch<GraphData>("GET", `/graph/${worldId}`);
}

export async function checkHealth(): Promise<{ status: string }> {
  return apiFetch("GET", "/health");
}
