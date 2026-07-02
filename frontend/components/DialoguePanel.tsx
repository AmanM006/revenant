"use client";
// components/DialoguePanel.tsx — Chat interface with citation log

import { useEffect, useRef, useState } from "react";
import { CitationLog } from "./CitationLog";
import type { ChatMessage, NpcId } from "@/lib/types";

interface Props {
  npcId: NpcId;
  npcName: string;
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (message: string) => void;
}

const NPC_COLORS: Record<NpcId, string> = {
  silas: "#78350F",
  elara: "#4C1D95",
  kael: "#1E3A5F",
};

const NPC_ICONS: Record<NpcId, string> = {
  silas: "🔨",
  elara: "✦",
  kael: "⚔",
};

const QUICK_ACTIONS: Array<{ label: string; value: string }> = [
  { label: "Who told you?", value: "Who told you that about me? How do you know?" },
  { label: "What do you know?", value: "What do you know about me?" },
  { label: "Can you help me?", value: "I need your assistance with something." },
  { label: "I'm innocent!", value: "I'm innocent. You've been misled about me." },
];

export function DialoguePanel({ npcId, npcName, messages, isThinking, onSend }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  function handleSend() {
    const text = input.trim();
    if (!text || isThinking) return;
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

  const npcColor = NPC_COLORS[npcId];
  const npcIcon = NPC_ICONS[npcId];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border rounded-t-lg"
        style={{ background: `${npcColor}22` }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm border border-white/20"
          style={{ background: npcColor }}
        >
          {npcIcon}
        </div>
        <span className="text-sm font-display font-semibold text-text">{npcName}</span>
        <span className="text-xs text-muted ml-1">— dialogue</span>
        {isThinking && (
          <div className="ml-auto flex gap-0.5 items-center">
            <span className="text-xs text-accent font-mono">thinking</span>
            <span className="animate-bounce delay-75 text-accent text-sm ml-1">.</span>
            <span className="animate-bounce delay-150 text-accent text-sm">.</span>
            <span className="animate-bounce delay-300 text-accent text-sm">.</span>
          </div>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-muted text-sm mt-8 font-mono">
            Approach {npcName} and speak your mind...
          </div>
        )}

        {messages.map((msg) => {
          const isNpc = msg.sender !== "player";
          return (
            <div key={msg.id} className={`flex ${isNpc ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] ${isNpc ? "" : "ml-auto"}`}>
                {/* Bubble */}
                <div
                  className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    isNpc
                      ? "bg-surface border border-border text-text rounded-tl-sm"
                      : "bg-accent/80 text-white rounded-tr-sm"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Trust delta badge (NPC only) */}
                {isNpc && msg.trust_delta !== undefined && msg.trust_delta !== 0 && (
                  <div className="flex items-center gap-1.5 mt-1 ml-1">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        msg.trust_delta > 0
                          ? "bg-green-900/40 text-green-300"
                          : "bg-red-900/40 text-danger"
                      }`}
                    >
                      Trust {msg.trust_delta > 0 ? "+" : ""}
                      {msg.trust_delta}
                    </span>
                    {msg.action && msg.action !== "none" && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300">
                        {msg.action.replace("_", " ")}
                      </span>
                    )}
                  </div>
                )}

                {/* Citations */}
                {isNpc && (msg.citations?.length || msg.provenance_chain?.length) ? (
                  <div className="ml-1">
                    <CitationLog
                      citations={msg.citations ?? []}
                      provenance={msg.provenance_chain}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border px-3 py-2 rounded-xl rounded-tl-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div className="px-3 py-1.5 border-t border-border flex gap-1.5 flex-wrap">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            onClick={() => onSend(qa.value)}
            disabled={isThinking}
            className="text-[10px] font-mono px-2 py-1 rounded border border-border text-muted hover:text-text hover:border-accent/40 transition-colors disabled:opacity-40"
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-border">
        <input
          ref={inputRef}
          id="dialogue-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={isThinking}
          placeholder={`Speak to ${npcName}...`}
          className="
            flex-1 bg-white/5 border border-border rounded-lg px-3 py-2 text-sm text-text
            placeholder:text-muted outline-none focus:border-accent transition-colors
            disabled:opacity-50 font-body
          "
        />
        <button
          id="dialogue-send"
          onClick={handleSend}
          disabled={isThinking || !input.trim()}
          className="
            px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-40
            text-white text-sm font-semibold rounded-lg transition-colors
          "
        >
          Send
        </button>
      </div>
    </div>
  );
}
