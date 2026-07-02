"use client";
// components/EngineControls.tsx — 3 engine action buttons at the bottom of the layout

interface Props {
  worldId: string;
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
  onTriggerRumorMill,
  onOpenAmnesia,
  onTimeSkip,
  timeskipLoading,
}: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-surface">
      {/* Rumor Mill */}
      <button
        id="btn-rumor-mill"
        onClick={onTriggerRumorMill}
        disabled={rumorLoading}
        className="
          flex-1 flex items-center justify-center gap-2
          px-4 py-2.5 rounded-lg border border-orange-500/40
          bg-orange-500/10 hover:bg-orange-500/20
          text-orange-300 font-semibold text-sm
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-wait
        "
      >
        {rumorLoading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            <span>Improving...</span>
          </>
        ) : (
          <>
            <span>🌐</span>
            <span>Trigger Rumor Mill</span>
          </>
        )}
      </button>

      {/* Amnesia */}
      <button
        id="btn-amnesia"
        onClick={onOpenAmnesia}
        disabled={gold < 50}
        className="
          flex-1 flex items-center justify-center gap-2
          px-4 py-2.5 rounded-lg border border-accent/40
          bg-accent/10 hover:bg-accent/20
          text-accent font-semibold text-sm
          transition-all duration-200
          disabled:opacity-40 disabled:cursor-not-allowed
        "
        title={gold < 50 ? "Need 50g for amnesia spell" : "Cast amnesia on a specific memory"}
      >
        <span>🧠</span>
        <span>Cast Amnesia</span>
        <span className="text-xs text-accent/60">(50g)</span>
      </button>

      {/* Time Skip */}
      <button
        id="btn-timeskip"
        onClick={onTimeSkip}
        disabled={timeskipLoading}
        className="
          flex-1 flex items-center justify-center gap-2
          px-4 py-2.5 rounded-lg border border-slate-500/40
          bg-white/5 hover:bg-white/10
          text-text font-semibold text-sm
          transition-all duration-200
          disabled:opacity-50
        "
      >
        {timeskipLoading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-text/20 border-t-text rounded-full animate-spin" />
            <span>Skipping...</span>
          </>
        ) : (
          <>
            <span>⏭</span>
            <span>Time Skip +1 Day</span>
          </>
        )}
      </button>
    </div>
  );
}
