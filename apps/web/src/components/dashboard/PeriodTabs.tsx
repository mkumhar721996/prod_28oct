"use client";

import { useRef } from "react";
import { PERIODS, nextPeriod, type Period } from "@/lib/stocks";

export function PeriodTabs({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const tabs = useRef<Partial<Record<Period, HTMLButtonElement | null>>>({});

  function onKeyDown(e: React.KeyboardEvent) {
    const next = nextPeriod(period, e.key);
    if (!next) return;
    e.preventDefault();
    onChange(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label="Chart period" onKeyDown={onKeyDown}>
      {PERIODS.map((p) => (
        <button
          key={p}
          ref={(el) => {
            tabs.current[p] = el;
          }}
          className="tab"
          role="tab"
          type="button"
          aria-selected={p === period}
          tabIndex={p === period ? 0 : -1}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
