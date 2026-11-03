import { formatPercent, formatRupees, type CardState, type WatchItem } from "@/lib/stocks";
import { ComingSoonButton } from "./ComingSoon";
import { DashboardCard } from "./DashboardCard";
import { Trend } from "./Trend";

export function WatchlistCard({ state, onRetry }: { state: CardState<WatchItem[]>; onRetry: () => void }) {
  return (
    <DashboardCard label="watchlist" title="Watchlist" headingId="h-watch" state={state} onRetry={onRetry}>
      {state.status === "ready" && (
        <div className="stack">
          <ul className="rows">
            {state.data.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span>
                  {formatRupees(item.price)}{" "}
                  <Trend up={item.changePercent >= 0}>{formatPercent(item.changePercent)}</Trend>
                </span>
              </li>
            ))}
          </ul>
          <div>
            <ComingSoonButton label="Add stock" />
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
