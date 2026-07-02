"use client";
// components/AmnesiaModal.tsx — document_id picker for surgical forget()

import { useEffect, useState } from "react";
import { forgetMemory, listMemories } from "@/lib/api";
import type { MemoryDocument, NpcId } from "@/lib/types";

interface Props {
  isOpen: boolean;
  npcId: NpcId;
  npcName: string;
  worldId: string;
  gold: number;
  onClose: () => void;
  onSuccess: (documentId: string, goldRemaining: number) => void;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  qa: "Dialogue",
  feedback: "Behavior record",
  trace: "Internal trace",
  skill_run: "Rumor / Action",
  unknown: "Memory",
};

function typeColor(type: string): string {
  switch (type) {
    case "qa": return "text-blue-400 bg-blue-900/20 border-blue-800/40";
    case "feedback": return "text-amber-400 bg-amber-900/20 border-amber-800/40";
    case "trace": return "text-violet-400 bg-violet-900/20 border-violet-800/40";
    case "skill_run": return "text-orange-400 bg-orange-900/20 border-orange-800/40";
    default: return "text-muted bg-white/5 border-border";
  }
}

export function AmnesiaModal({
  isOpen,
  npcId,
  npcName,
  worldId,
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
    listMemories(npcId, worldId)
      .then((d) => {
        setDocs(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [isOpen, npcId, worldId]);

  async function handleCast() {
    if (!selected) return;
    if (gold < 50) {
      setError("Not enough gold. Amnesia costs 50g.");
      return;
    }
    setCasting(selected);
    setError(null);
    try {
      const result = await forgetMemory(npcId, selected, worldId);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,11,20,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="bg-surface border border-accent/40 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <span className="text-2xl">🧠</span>
          <div>
            <h2 className="font-display font-bold text-text text-lg">Amnesia Spell</h2>
            <p className="text-xs text-muted">
              Erase a specific memory from {npcName}&apos;s mind — costs{" "}
              <span className="text-accent2 font-bold">50g</span>. You have{" "}
              <span className={gold < 50 ? "text-danger" : "text-accent2"}>
                {gold}g
              </span>
              .
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-muted hover:text-text text-xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted text-sm">
              <span className="w-3 h-3 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
              Loading memories...
            </div>
          )}

          {!loading && docs.length === 0 && (
            <p className="text-muted text-sm font-mono text-center py-6">
              {npcName} has no erasable memories yet.<br />
              Interact with them first.
            </p>
          )}

          {!loading && docs.length > 0 && (
            <div className="space-y-2">
              {docs.map((doc) => {
                const isSelected = selected === doc.document_id;
                return (
                  <button
                    key={doc.document_id}
                    onClick={() => setSelected(isSelected ? null : doc.document_id)}
                    className={`
                      w-full text-left rounded-lg p-3 border transition-all duration-150
                      ${isSelected
                        ? "border-accent bg-accent/10"
                        : "border-border bg-white/5 hover:border-accent/30"
                      }
                    `}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${typeColor(doc.type)}`}
                      >
                        {ENTRY_TYPE_LABELS[doc.type] ?? doc.type}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-text leading-snug">{doc.description}</p>
                        {doc.game_day !== "?" && (
                          <p className="text-[10px] text-muted font-mono mt-0.5">
                            Day {doc.game_day}
                            {doc.timestamp ? ` · ${doc.timestamp.slice(0, 16).replace("T", " ")}` : ""}
                          </p>
                        )}
                        <p className="text-[10px] font-mono text-muted/60 mt-0.5 truncate">
                          {doc.document_id}
                        </p>
                        {doc.content_preview && (
                          <p className="text-[11px] text-muted mt-1 leading-relaxed">
                            {doc.content_preview}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center gap-3">
          {error && (
            <p className="text-danger text-xs font-mono flex-1">{error}</p>
          )}
          {success && !error && (
            <p className="text-green-400 text-xs font-mono flex-1">{success}</p>
          )}
          {!error && !success && (
            <p className="text-muted text-xs flex-1">
              {selected ? "Selected. Click Cast to proceed." : "Select a memory to erase."}
            </p>
          )}

          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-muted hover:text-text border border-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-amnesia"
            onClick={handleCast}
            disabled={!selected || casting !== null || gold < 50}
            className="
              px-4 py-1.5 bg-accent hover:bg-accent/80 disabled:opacity-40
              text-white text-sm font-semibold rounded-lg transition-colors
              flex items-center gap-2
            "
          >
            {casting ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Casting...
              </>
            ) : (
              "Cast Amnesia (-50g)"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
