"use client";
// components/EngineControls.tsx — Arcane console actions bar with proper SVG icons

interface Props {
  gold: number;
  rumorLoading: boolean;
  onTriggerRumorMill: () => void;
  onOpenAmnesia: () => void;
  onTimeSkip: () => void;
  timeskipLoading: boolean;
}

export function EngineControls({
  gold,
  rumorLoading,
  onOpenAmnesia,
  onTriggerRumorMill,
  onTimeSkip,
  timeskipLoading,
}: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-surface shrink-0">
      {/* Rumor Mill Button */}
      <button
        id="btn-rumor-mill"
        onClick={onTriggerRumorMill}
        disabled={rumorLoading}
        className="
          flex-1 flex items-center justify-center gap-2.5
          px-5 py-3.5 rounded-lg border border-border bg-surface
          font-display text-[13px] tracking-wider uppercase font-semibold
          transition-all duration-200 cursor-pointer text-primary
          hover:bg-orange-dim/20 hover:border-orange hover:text-orange
          disabled:opacity-50 disabled:cursor-wait
        "
      >
        {rumorLoading ? (
          <>
            <svg
              className="w-4 h-4 animate-spin text-orange"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="9" strokeDasharray="24" strokeDashoffset="8" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            <span>PROPAGATING...</span>
          </>
        ) : (
          <>
            {/* Network graph SVG */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-4 h-4"
            >
              <circle cx="8" cy="2" r="1.5" />
              <circle cx="2" cy="13" r="1.5" />
              <circle cx="14" cy="13" r="1.5" />
              <line x1="8" y1="3.5" x2="2" y2="11.5" />
              <line x1="8" y1="3.5" x2="14" y2="11.5" />
              <line x1="3.5" y1="13" x2="12.5" y2="13" />
            </svg>
            <span>Trigger Rumor Mill</span>
          </>
        )}
      </button>

      {/* Amnesia Spell Button */}
      <button
        id="btn-amnesia"
        onClick={onOpenAmnesia}
        disabled={gold < 50}
        className="
          flex-1 flex items-center justify-center gap-2.5
          px-5 py-3.5 rounded-lg border border-border bg-surface
          font-display text-[13px] tracking-wider uppercase font-semibold
          transition-all duration-200 cursor-pointer text-primary
          hover:bg-purple-dim/20 hover:border-purple hover:text-purple-glow
          disabled:opacity-40 disabled:cursor-not-allowed
        "
        title={gold < 50 ? "Requires 50 gold" : "Cast Amnesia"}
      >
        {/* Eye with slash SVG */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-4 h-4"
        >
          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
          <circle cx="8" cy="8" r="2" />
          <line x1="2" y1="2" x2="14" y2="14" strokeWidth="1.5" />
        </svg>
        <span>Cast Amnesia</span>
        <span className="text-[10px] font-mono opacity-80">(50g)</span>
      </button>

      {/* Time Skip Button */}
      <button
        id="btn-timeskip"
        onClick={onTimeSkip}
        disabled={timeskipLoading}
        className="
          flex-1 flex items-center justify-center gap-2.5
          px-5 py-3.5 rounded-lg border border-border bg-surface
          font-display text-[13px] tracking-wider uppercase font-semibold
          transition-all duration-200 cursor-pointer text-primary
          hover:bg-hover hover:border-bright
          disabled:opacity-50
        "
      >
        {timeskipLoading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span>SKIPPING...</span>
          </>
        ) : (
          <>
            {/* Hourglass SVG */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-4 h-4"
            >
              <path d="M4 2h8M4 14h8M5 2v2l3 4-3 4v2M11 2v2L8 8l3 4v2" />
            </svg>
            <span>Time Skip +1 Day</span>
          </>
        )}
      </button>
    </div>
  );
}
