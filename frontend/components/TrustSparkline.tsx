"use client";
// components/TrustSparkline.tsx — Recharts mini trust chart per NPC

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TrustHistoryEntry } from "@/lib/types";

interface Props {
  history: TrustHistoryEntry[];
  compact?: boolean;
}

const CustomDot = (props: {
  cx?: number;
  cy?: number;
  payload?: TrustHistoryEntry;
}) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;

  const color =
    payload.delta > 0
      ? "#22C55E"
      : payload.delta < 0 && payload.event === "rumor_propagation"
      ? "#F97316"
      : payload.delta < 0
      ? "#EF4444"
      : undefined;

  if (!color) return null;

  return <circle cx={cx} cy={cy} r={3} fill={color} stroke="none" />;
};

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrustHistoryEntry }>;
}) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded px-2 py-1 text-xs font-mono">
      <div className="text-muted">Day {entry.day}</div>
      <div className="text-text">{entry.score}/100</div>
      {entry.event && (
        <div
          className={
            entry.event === "rumor_propagation"
              ? "text-rumor"
              : entry.delta > 0
              ? "text-green-400"
              : "text-danger"
          }
        >
          {entry.event} {entry.delta > 0 ? "+" : ""}
          {entry.delta !== 0 ? entry.delta : ""}
        </div>
      )}
    </div>
  );
};

export function TrustSparkline({ history, compact = false }: Props) {
  const data = useMemo(() => history.slice(-10), [history]);

  if (!data.length) {
    return (
      <div className="h-10 flex items-center justify-center text-muted text-xs font-mono">
        no history
      </div>
    );
  }

  const height = compact ? 32 : 48;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <ReferenceLine y={40} stroke="#F97316" strokeDasharray="3 3" strokeOpacity={0.4} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#7C3AED"
          strokeWidth={1.5}
          dot={<CustomDot />}
          activeDot={{ r: 4, fill: "#7C3AED" }}
          isAnimationActive={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
