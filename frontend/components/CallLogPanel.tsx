"use client";
// components/CallLogPanel.tsx — Live Cognee Cloud API call monitor with timing logs

import { useEffect, useState } from "react";

interface CallLogEntry {
  ts: string;
  op: string;
  endpoint: string;
  dataset: string;
  status: number;
  latency_ms: number;
  summary?: string;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function CallLogPanel() {
  const [logs, setLogs] = useState<CallLogEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    
    const fetchLogs = async () => {
      try {
        const data = await fetch(`${BASE}/call-log`).then((r) => r.json());
        if (Array.isArray(data)) {
          setLogs(data);
        }
      } catch (err) {
        console.error("Failed to fetch Cognee call logs:", err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [open]);

  return (
    <div className="call-log-panel">
      <button onClick={() => setOpen((o) => !o)} className="call-log-toggle">
        <span className="call-log-label">⚡ COGNEE CALL MONITOR</span>
        <span className="call-log-count">{logs.length} logged</span>
      </button>

      {open && (
        <div className="call-log-entries">
          {logs.length === 0 ? (
            <div className="text-[9px] font-mono text-muted py-2 text-center">
              No API calls logged yet. Interact with NPCs to generate calls.
            </div>
          ) : (
            logs.slice(0, 10).map((log, i) => (
              <div key={i} className="call-log-entry">
                <span className="call-op" title={log.summary || log.endpoint}>
                  {log.op}
                </span>
                <span className="call-status" data-ok={log.status < 400}>
                  {log.status}
                </span>
                <span className="call-latency">{log.latency_ms}ms</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
