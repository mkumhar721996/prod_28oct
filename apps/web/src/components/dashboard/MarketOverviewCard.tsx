import { formatPercent, formatPoints, type CardState, type Index } from "@/lib/stocks";
import { DashboardCard } from "./DashboardCard";
import { Trend } from "./Trend";

export function MarketOverviewCard({ state, onRetry }: { state: CardState<Index[]>; onRetry: () => void }) {
  return (
    <DashboardCard
      label="market overview"
      title="Market overview"
      headingId="h-market"
      state={state}
      onRetry={onRetry}
    >
      {state.status === "ready" && (
        <div className="tiles">
          {state.data.map((index) => (
            <div key={index.id} className="tile">
              <div className="tile-label">{index.name}</div>
              <div className="tile-value">{formatPoints(index.points)}</div>
              <Trend up={index.changePercent >= 0}>
                {index.changePercent >= 0 ? "Up" : "Down"} {formatPercent(index.changePercent)}
              </Trend>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
