"use client";
// components/AmnesiaModal.tsx — Redesigned amnesia memory selector modal with type badges and radio items

import { useEffect, useState } from "react";
import { forgetMemory, listMemories } from "@/lib/api";
import type { MemoryDocument, NpcId } from "@/lib/types";

interface Props {
  isOpen: boolean;
  npcId: NpcId;
  npcName: string;
  gold: number;
  onClose: () => void;
  onSuccess: (documentId: string, goldRemaining: number) => void;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  qa: "Dialogue",
  feedback: "Behavior",
  trace: "Reasoning",
  skill_run: "Action",
  unknown: "Memory",
};

function typeColor(type: string): string {
  switch (type) {
    case "qa":
      return "text-blue bg-blue/10 border-blue/30";
    case "feedback":
      return "text-amber bg-amber/10 border-amber/30";
    case "trace":
      return "text-purple-glow bg-purple-dim/30 border-purple/30";
    case "skill_run":
      return "text-orange bg-orange-dim/20 border-orange/30";
    default:
      return "text-primary bg-white/5 border-border";
  }
}

export function AmnesiaModal({
  isOpen,
  npcId,
  npcName,
  gold,
  onClose,
  onSuccess,
}: Props) {
  const [docs, setDocs] = useState<MemoryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [casting, setCasting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDocs([]);
      setError(null);
      setSuccess(null);
      setSelected(null);
      return;
    }
    setLoading(true);
    listMemories(npcId)
      .then((d) => {
        setDocs(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [isOpen, npcId]);

  async function handleCast() {
    if (!selected) return;
    if (gold < 50) {
      setError("Not enough gold. Amnesia costs 50g.");
      return;
    }
    setCasting(selected);
    setError(null);
    try {
      const result = await forgetMemory(npcId, selected);
      setSuccess(result.message);
      onSuccess(selected, result.gold_remaining);
      setDocs((prev) => prev.filter((d) => d.document_id !== selected));
      setSelected(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCasting(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(6,8,15,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="bg-surface border border-purple/40 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header Block */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-raised">
          <span className="text-2xl">🧠</span>
          <div>
            <h2 className="font-display font-bold text-primary text-base tracking-wider uppercase">
              Amnesia Spell
            </h2>
            <p className="text-[11px] font-body text-secondary mt-0.5">
              Erase a specific memory from <span className="text-purple-glow font-semibold">{npcName}</span>&apos;s mind.
            </p>
            <p className="text-[10px] font-mono text-muted mt-0.5">
              Cost: <span className="text-amber-glow font-bold">50g</span> · You have:{" "}
              <span className={gold < 50 ? "text-red font-bold" : "text-amber-glow font-bold"}>
                {gold}g
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-secondary hover:text-primary text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-void/35">
          {loading && (
            <div className="flex items-center gap-2 text-secondary text-xs font-mono justify-center py-10">
              <span className="w-4 h-4 border-2 border-purple-glow/30 border-t-purple-glow rounded-full animate-spin" />
              Tapping magical vectors...
            </div>
          )}

          {!loading && docs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-secondary text-xs font-mono">
                {npcName} has no erasable memories yet.
              </p>
              <p className="text-[10px] text-muted font-body mt-1">
                Interact with them in dialogue to register memories.
              </p>
            </div>
          )}

          {!loading && docs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-display text-muted uppercase tracking-wider mb-2">
                Select memory to sever:
              </p>

              {docs.map((doc) => {
                const isSelected = selected === doc.document_id;
                const safeDesc = doc.description.replace("→", "->");

                return (
                  <button
                    key={doc.document_id}
                    onClick={() => setSelected(isSelected ? null : doc.document_id)}
                    className={`
                      w-full text-left rounded-xl p-3 border transition-all duration-200 flex items-start gap-3
                      ${
                        isSelected
                          ? "border-purple bg-purple/10 shadow-[0_0_12px_rgba(124,58,237,0.1)]"
                          : "border-border bg-raised hover:border-bright hover:bg-hover"
                      }
                    `}
                  >
                    {/* Radio input circle icon */}
                    <div className="mt-1 shrink-0">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? "border-purple bg-purple" : "border-border bg-void"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>

                    {/* Description details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className={`text-[9px] font-display tracking-wider font-semibold px-2 py-0.5 rounded border uppercase shrink-0 ${typeColor(
                            doc.type
                          )}`}
                        >
                          {ENTRY_TYPE_LABELS[doc.type] ?? doc.type}
                        </span>
                        {doc.game_day !== "?" && (
                          <span className="text-[9px] text-muted font-mono">
                            Day {doc.game_day}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-primary font-body leading-snug break-words">
                        {safeDesc}
                      </p>
                      <p className="text-[9px] font-mono text-muted/65 mt-1 truncate">
                        ID: {doc.document_id}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border flex items-center gap-3 bg-raised">
          {error && (
            <p className="text-red text-xs font-mono flex-1 leading-tight break-words">{error}</p>
          )}
          {success && !error && (
            <p className="text-green text-xs font-mono flex-1 leading-tight break-words">{success}</p>
          )}
          {!error && !success && (
            <p className="text-secondary text-[11px] font-body flex-1">
              {selected ? "Arcane vector aligned. Cast spell when ready." : "Select a memory to sever."}
            </p>
          )}

          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-display tracking-wider uppercase text-secondary hover:text-primary border border-border rounded-lg transition-colors cursor-pointer bg-surface"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-amnesia"
            onClick={handleCast}
            disabled={!selected || casting !== null || gold < 50}
            className="
              px-4 py-2 bg-purple hover:bg-purple-glow disabled:opacity-40
              text-white text-xs font-display tracking-wider uppercase rounded-lg transition-all duration-200
              flex items-center gap-2 cursor-pointer
            "
          >
            {casting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Severing...</span>
              </>
            ) : (
              "Cast Spell"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
