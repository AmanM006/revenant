"use client";
// components/RumorToast.tsx — Replaces old orange propagating pill with premium toast notification

import { useEffect } from "react";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function RumorToast({ visible, onDismiss }: Props) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onDismiss, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss]);

  return (
    <div className={`rumor-toast ${visible ? "visible" : ""}`}>
      <div className="rumor-toast-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="2" r="1.5" fill="currentColor" />
          <circle cx="2" cy="11" r="1.5" fill="currentColor" />
          <circle cx="12" cy="11" r="1.5" fill="currentColor" />
          <line x1="7" y1="3.5" x2="2" y2="9.5" stroke="currentColor" strokeWidth="1" />
          <line x1="7" y1="3.5" x2="12" y2="9.5" stroke="currentColor" strokeWidth="1" />
          <line x1="2" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
      <span>Rumor propagating through graph</span>
    </div>
  );
}
