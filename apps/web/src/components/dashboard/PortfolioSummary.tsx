import { formatRupees, formatSigned, formatSignedPercent, type CardState, type Summary } from "@/lib/stocks";
import { DashboardCard } from "./DashboardCard";
import { InfoTip } from "./InfoTip";
import { Trend } from "./Trend";

export function PortfolioSummary({ state, onRetry }: { state: CardState<Summary>; onRetry: () => void }) {
  return (
    <DashboardCard label="portfolio summary" state={state} onRetry={onRetry}>
      {state.status === "ready" && (
        <div className="tiles">
          <div className="tile">
            <div className="tile-label">Portfolio value</div>
            <div className="tile-value">{formatRupees(state.data.portfolioValue)}</div>
          </div>
          <div className="tile">
            <div className="tile-label">
              Today&apos;s P&amp;L{" "}
              <InfoTip
                id="tip-pnl"
                label="What is P&L?"
                text="Profit and loss: how much your holdings gained or lost in value today."
              />
            </div>
            <div className="tile-value">
              <Trend up={state.data.todaysPnl >= 0}>{formatSigned(state.data.todaysPnl)}</Trend>
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">
              Total return{" "}
              <InfoTip
                id="tip-ret"
                label="What is total return?"
                text="Overall gain or loss on everything you have invested, as a percentage of what you put in."
              />
            </div>
            <div className="tile-value">
              <Trend up={state.data.totalReturnPercent >= 0}>
                {formatSignedPercent(state.data.totalReturnPercent)}
              </Trend>
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">Active SIPs</div>
            <div className="tile-value">{state.data.activeSips}</div>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
