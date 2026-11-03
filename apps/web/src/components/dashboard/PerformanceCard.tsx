"use client";

import { useState } from "react";
import { DEFAULT_PERIOD, type CardState, type Performance, type Period } from "@/lib/stocks";
import { DashboardCard } from "./DashboardCard";
import { InfoTip } from "./InfoTip";
import { PerformanceChart } from "./PerformanceChart";
import { PeriodTabs } from "./PeriodTabs";

type PerformanceCardProps = {
  state: CardState<Performance>;
  onRetry: () => void;
  /** Starting tab, to render a given period without clicks (tests). */
  initialPeriod?: Period;
};

/** Owns the period, so choosing a tab re-renders this card only. */
export function PerformanceCard({ state, onRetry, initialPeriod = DEFAULT_PERIOD }: PerformanceCardProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  return (
    <DashboardCard
      label="performance chart"
      title="Portfolio performance vs benchmark"
      headingId="h-perf"
      state={state}
      onRetry={onRetry}
    >
      {state.status === "ready" && (
        <>
          <div className="scroll">
            <PerformanceChart series={state.data[period]} />
          </div>
          <ul className="cluster legend">
            <li>
              <span className="badge badge-neutral">
                <span className="swatch" aria-hidden="true" />
                &nbsp;Portfolio
              </span>
            </li>
            <li>
              <span className="badge badge-neutral">
                <span className="swatch swatch-b" aria-hidden="true" />
                &nbsp;Benchmark (NIFTY 50)
              </span>{" "}
              <InfoTip
                id="tip-bench"
                label="What is the benchmark?"
                text="A market index to compare against. If your line is above the dashed one, you beat the NIFTY 50."
              />
            </li>
          </ul>
          <PeriodTabs period={period} onChange={setPeriod} />
          <p className="text-sm text-muted period-note" role="status">
            {state.data[period].note}
          </p>
        </>
      )}
    </DashboardCard>
  );
}
