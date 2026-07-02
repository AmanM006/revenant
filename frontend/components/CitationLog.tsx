"use client";
// components/CitationLog.tsx — Ranked recall() citations display

import { useState } from "react";
import type { CitationEntry, ProvenanceStep } from "@/lib/types";

interface Props {
  citations: CitationEntry[];
  provenance?: ProvenanceStep[];
}

function typeColor(type: string): string {
  switch (type) {
    case "qa": return "text-blue-400";
    case "feedback": return "text-amber-400";
    case "trace": return "text-violet-400";
    case "skill_run": return "text-orange-400";
    default: return "text-muted";
  }
}

function scoreBadge(score: number): string {
  if (score > 0.8) return "bg-green-900/40 text-green-300";
  if (score > 0.5) return "bg-amber-900/40 text-amber-300";
  return "bg-slate-800 text-muted";
}

export function CitationLog({ citations, provenance }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!citations.length && !provenance?.length) return null;

  return (
    <div className="mt-3 border-t border-border pt-2">
      {/* Provenance chain */}
      {provenance && provenance.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-orange-400 font-mono uppercase tracking-widest mb-1.5">
            ⛓ Graph Traversal Chain
          </p>
          <div className="space-y-0.5">
            {provenance.map((step) => (
              <div
                key={step.step}
                className="flex items-start gap-2 text-xs font-mono"
              >
                <span className="text-muted shrink-0">{step.step}.</span>
                <span className={typeColor(step.type)} title={step.content_preview}>
                  [{step.type}]
                </span>
                <span className="text-text/70 truncate">{step.document_id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranked citations */}
      {citations.length > 0 && (
        <>
          <p className="text-xs text-muted font-mono uppercase tracking-widest mb-1.5">
            Citations
          </p>
          <div className="space-y-1">
            {citations.map((c, i) => {
              const isOpen = expanded === c.document_id;
              const prefix = i === citations.length - 1 ? "└" : "├";
              return (
                <div key={c.document_id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.document_id)}
                    className="flex items-start gap-1.5 w-full text-left hover:bg-white/5 rounded px-1 py-0.5 transition-colors"
                  >
                    <span className="text-border font-mono text-xs shrink-0 mt-px">{prefix}</span>
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-mono text-xs text-text/80 truncate max-w-[180px]">
                        {c.document_id}
                      </span>
                      <span className={`text-[10px] font-mono ${typeColor(c.type)}`}>
                        {c.type}
                      </span>
                      {c.timestamp && (
                        <span className="text-[10px] text-muted font-mono truncate">
                          {c.timestamp.slice(0, 16).replace("T", " ")}
                        </span>
                      )}
                      {c.score > 0 && (
                        <span className={`text-[10px] px-1 rounded font-mono ${scoreBadge(c.score)}`}>
                          {c.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </button>
                  {isOpen && c.content_preview && (
                    <div className="ml-6 mt-0.5 text-[11px] font-mono text-muted bg-white/5 rounded px-2 py-1.5 border border-border/50">
                      {c.content_preview}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
