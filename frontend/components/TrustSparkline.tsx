"use client";
// components/TrustSparkline.tsx — Overhauled sparkline with area gradients and custom dots using Recharts ComposedChart

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  YAxis,
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

  // Dot color based on trust change event
  const color =
    payload.delta > 0
      ? "#10B981" // green for positive delta
      : payload.delta < 0 && payload.event === "rumor_propagation"
      ? "#F97316" // orange for rumors
      : payload.delta < 0
      ? "#EF4444" // red for betrayal/negative actions
      : null;

  if (!color) return null;

  return <circle cx={cx} cy={cy} r={2.5} fill={color} stroke="none" />;
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
    <div className="bg-surface border border-border rounded-lg p-2 text-[10px] font-mono shadow-md">
      <div className="text-secondary/75">Day {entry.day}</div>
      <div className="text-primary font-bold">{entry.score}/100</div>
      {entry.event && (
        <div
          className={`font-semibold mt-0.5 uppercase tracking-wide text-[9px] ${
            entry.event === "rumor_propagation"
              ? "text-orange"
              : entry.delta > 0
              ? "text-green"
              : "text-red"
          }`}
        >
          {entry.event.replace("_", " ")} ({entry.delta > 0 ? "+" : ""}
          {entry.delta})
        </div>
      )}
    </div>
  );
};

export function TrustSparkline({ history, compact = false }: Props) {
  const data = useMemo(() => history.slice(-12), [history]);

  if (!data.length) {
    return (
      <div className="h-10 flex items-center justify-center text-muted text-[10px] font-mono">
        no trust records
      </div>
    );
  }

  const height = compact ? 50 : 60;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="trustGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
          </linearGradient>
        </defs>

        <YAxis domain={[0, 100]} hide />
        
        {/* Safe threshold guide at 40 */}
        <ReferenceLine y={40} stroke="#F97316" strokeDasharray="3 3" strokeOpacity={0.25} />

        <Tooltip content={<CustomTooltip />} />

        {/* Underlay Gradient */}
        <Area
          type="monotone"
          dataKey="score"
          fill="url(#trustGrad)"
          stroke="none"
          isAnimationActive={true}
        />

        {/* Top boundary stroke line */}
        <Line
          type="monotone"
          dataKey="score"
          stroke="#7C3AED"
          strokeWidth={1.5}
          dot={<CustomDot />}
          activeDot={{ r: 3.5, fill: "#A78BFA", stroke: "#7C3AED", strokeWidth: 1 }}
          isAnimationActive={true}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
