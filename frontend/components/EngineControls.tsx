"use client";
// components/EngineControls.tsx — Arcane console actions bar for rumor mill, amnesia spell, and timeskip

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
            {/* Spinning Rune SVG */}
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
            {/* Network nodes SVG icon */}
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
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
        {/* Brain SVG Icon */}
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z" />
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z" />
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
            {/* Hourglass SVG Icon */}
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 2h14" />
              <path d="M5 22h14" />
              <path d="M19 2v4c0 3.3-2.7 6-6 6h-2c-3.3 0-6-2.7-6-6V2" />
              <path d="M5 22v-4c0-3.3 2.7-6 6-6h2c3.3 0 6 2.7 6 6v4" />
            </svg>
            <span>Time Skip +1 Day</span>
          </>
        )}
      </button>
    </div>
  );
}
