"use client";
// components/DialoguePanel.tsx — Overhauled chat panel with streaming message rendering, progress step logs, and proper custom SVGs

import { useEffect, useRef, useState } from "react";
import { CitationLog } from "./CitationLog";
import { Silas } from "./portraits/Silas";
import { Elara } from "./portraits/Elara";
import { Kael } from "./portraits/Kael";
import type { ChatMessage, NpcId } from "@/lib/types";

interface Props {
  npcId: NpcId;
  npcName: string;
  messages: ChatMessage[];
  trust: number;
  isThinking: boolean;
  thinkingStep: string;
  streamingText: string;
  onSend: (message: string) => void;
}

const PortraitComponent = ({ id, size }: { id: NpcId; size?: number }) => {
  switch (id) {
    case "silas":
      return <Silas size={size} />;
    case "elara":
      return <Elara size={size} />;
    case "kael":
      return <Kael size={size} />;
  }
};

const QUICK_ACTIONS: Array<{ label: string; value: string }> = [
  { label: "Who told you?", value: "Who told you that about me? How do you know?" },
  { label: "What do you know?", value: "What do you know about me?" },
  { label: "Can you help me?", value: "I need your assistance with something." },
  { label: "I'm innocent!", value: "I'm innocent. You've been misled about me." },
];

export function DialoguePanel({
  npcId,
  npcName,
  messages,
  trust,
  isThinking,
  thinkingStep,
  streamingText,
  onSend,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, streamingText]);

  function handleSend() {
    const text = input.trim();
    if (!text || isThinking || streamingText) return;
    onSend(text);
    setInput("");
    inputRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden shadow-xl">
      {/* Header Section */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-raised">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-void shrink-0">
          <PortraitComponent id={npcId} size={40} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-display font-bold text-primary tracking-wide uppercase leading-tight">
            {npcName}
          </h2>
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
            dialogue mode
          </span>
        </div>

        {/* Trust badge */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-mono text-secondary uppercase tracking-widest hidden sm:inline">
            trust level:
          </span>
          <span className="text-xs font-mono font-bold bg-amber-dim/30 border border-amber/30 text-amber-glow px-2 py-0.5 rounded">
            {trust}/100
          </span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-void/30">
        {messages.length === 0 && !streamingText && !isThinking && (
          <div className="text-center text-muted text-xs mt-12 font-mono max-w-xs mx-auto leading-relaxed border border-border/20 rounded-lg p-4 bg-void/50">
            📖 You stand before {npcName}. Speak with honor, or tread carefully. Their memory is absolute.
          </div>
        )}

        {messages.map((msg) => {
          const isNpc = msg.sender !== "player";
          return (
            <div key={msg.id} className={`flex flex-col ${isNpc ? "items-start" : "items-end"}`}>
              {/* NPC Name Title above bubble */}
              {isNpc && (
                <span className="font-display text-[10px] text-purple-glow tracking-wider mb-1 ml-2">
                  {npcName.toUpperCase()}
                </span>
              )}

              {/* Message bubble */}
              <div
                className={`px-4 py-2.5 rounded-xl text-[14px] font-body leading-relaxed max-w-[80%] ${
                  isNpc
                    ? "bg-surface border border-border text-primary rounded-tl-none border-l-2 border-l-purple"
                    : "bg-raised border border-border/80 text-primary rounded-tr-none border-r-2 border-r-amber ml-auto"
                }`}
              >
                {msg.text}
              </div>

              {/* Trust delta badge (NPC only) */}
              {isNpc && msg.trust_delta !== undefined && msg.trust_delta !== 0 && (
                <div className="flex items-center gap-1.5 mt-1 ml-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      msg.trust_delta > 0
                        ? "bg-green/10 border-green/30 text-green"
                        : "bg-red/10 border-red/30 text-red"
                    }`}
                  >
                    Trust {msg.trust_delta > 0 ? "+" : ""}
                    {msg.trust_delta}
                  </span>
                  {msg.action && msg.action !== "none" && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-dim/20 border border-orange/20 text-orange">
                      {msg.action.replace("_", " ")}
                    </span>
                  )}
                </div>
              )}

              {/* Citations block */}
              {isNpc && (msg.citations?.length || msg.provenance_chain?.length) ? (
                <div className="w-full max-w-[90%] mt-2 ml-2">
                  <CitationLog
                    citations={msg.citations ?? []}
                    provenance={msg.provenance_chain}
                  />
                </div>
              ) : null}
            </div>
          );
        })}

        {/* Streaming text bubble */}
        {streamingText && (
          <div className="flex flex-col items-start animate-fade-in">
            <span className="font-display text-[10px] text-purple-glow tracking-wider mb-1 ml-2">
              {npcName.toUpperCase()}
            </span>
            <div className="npc-bubble streaming px-4 py-2.5 rounded-xl text-[14px] font-body leading-relaxed max-w-[80%] bg-surface border border-border text-primary rounded-tl-none border-l-2 border-l-purple shadow-sm">
              {streamingText}
              <span className="cursor-blink ml-1 text-purple-glow animate-pulse">▊</span>
            </div>
          </div>
        )}

        {/* Step-by-step thinking indicator */}
        {isThinking && (
          <div className="flex flex-col items-start thinking-indicator">
            <span className="font-display text-[10px] text-purple-glow tracking-wider mb-1 ml-2">
              {npcName.toUpperCase()}
            </span>
            <div className="bg-surface border border-border px-4 py-3 rounded-xl rounded-tl-none border-l-2 border-l-purple flex items-center gap-3">
              <div className="thinking-dots flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-purple rounded-full animate-pulse-stagger" style={{ animationDelay: "0s" }} />
                <span className="w-1.5 h-1.5 bg-purple rounded-full animate-pulse-stagger" style={{ animationDelay: "0.4s" }} />
                <span className="w-1.5 h-1.5 bg-purple rounded-full animate-pulse-stagger" style={{ animationDelay: "0.8s" }} />
              </div>
              <span className="thinking-step text-xs font-mono text-secondary">{thinkingStep}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Action Chips */}
      <div className="px-4 py-2 border-t border-border bg-surface/50 flex gap-2 flex-wrap items-center">
        <span className="text-[9px] font-mono text-muted uppercase tracking-wider mr-1">
          Quick Speak:
        </span>
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            onClick={() => onSend(qa.value)}
            disabled={isThinking || !!streamingText}
            className="text-[11px] font-body px-2.5 py-1 rounded border border-border text-secondary hover:text-primary hover:border-bright hover:bg-hover transition-all duration-150 disabled:opacity-40"
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="flex gap-2 p-3 border-t border-border bg-raised">
        <input
          ref={inputRef}
          id="dialogue-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={isThinking || !!streamingText}
          placeholder={`Speak to ${npcName}...`}
          className="
            flex-1 bg-void border border-border rounded-lg px-3 py-2 text-[14px] text-primary
            placeholder:text-muted outline-none focus:border-purple focus:ring-1 focus:ring-purple/20 transition-all duration-200
            disabled:opacity-50 font-body
          "
        />
        <button
          id="dialogue-send"
          onClick={handleSend}
          disabled={isThinking || !!streamingText || !input.trim()}
          className="
            px-5 py-2 bg-purple hover:bg-purple-glow text-white text-xs font-display tracking-wider uppercase rounded-lg transition-all duration-200 disabled:opacity-40
          "
        >
          Send
        </button>
      </div>
    </div>
  );
}
