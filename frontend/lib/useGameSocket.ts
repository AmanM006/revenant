"use client";
// lib/useGameSocket.ts — WebSocket hook for live graph event streaming

import { useCallback, useEffect, useRef } from "react";
import type {
  GraphLink,
  GraphNode,
  NpcId,
  WsEvent,
} from "./types";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export interface SocketHandlers {
  onRumorInjected?: (from: NpcId, to: NpcId, label: string) => void;
  onNodeDissolve?: (documentId: string, npcId: NpcId) => void;
  onTrustUpdate?: (npcId: NpcId, score: number, reason: string) => void;
  onGraphUpdated?: (nodes: GraphNode[], edges: GraphLink[]) => void;
  onDayAdvanced?: (gameDay: number) => void;
}

export function useGameSocket(worldId: string | null, handlers: SocketHandlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnect = useRef(true);

  // Keep handlers ref fresh without recreating effect
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const connect = useCallback(() => {
    if (!worldId) return;

    const ws = new WebSocket(`${WS_BASE}/ws/${worldId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to world: ${worldId}`);
    };

    ws.onmessage = (event) => {
      let data: WsEvent;
      try {
        data = JSON.parse(event.data) as WsEvent;
      } catch {
        return;
      }

      const h = handlersRef.current;

      switch (data.type) {
        case "rumor_injected":
          h.onRumorInjected?.(data.from, data.to, data.label);
          break;
        case "node_dissolve":
          h.onNodeDissolve?.(data.document_id, data.npc_id);
          break;
        case "trust_update":
          h.onTrustUpdate?.(data.npc_id, data.score, data.reason);
          break;
        case "graph_updated":
          h.onGraphUpdated?.(data.nodes, data.edges as GraphLink[]);
          break;
        case "day_advanced":
          h.onDayAdvanced?.(data.game_day);
          break;
      }
    };

    ws.onerror = (err) => {
      console.warn("[WS] Error:", err);
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected.");
      if (shouldReconnect.current) {
        reconnectTimeout.current = setTimeout(() => {
          console.log("[WS] Reconnecting...");
          connect();
        }, 3000);
      }
    };
  }, [worldId]);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();

    return () => {
      shouldReconnect.current = false;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { send };
}
