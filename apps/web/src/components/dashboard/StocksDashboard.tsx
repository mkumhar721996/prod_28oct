"use client";

import {
  fetchAllocation,
  fetchGoals,
  fetchHoldings,
  fetchInsights,
  fetchMarketOverview,
  fetchPerformance,
  fetchSips,
  fetchSummary,
  fetchTransactions,
  fetchWatchlist,
  type Allocation,
  type CardState,
  type Goal,
  type Holding,
  type Index,
  type Insight,
  type Performance,
  type Sip,
  type Summary,
  type Transaction,
  type WatchItem,
} from "@/lib/stocks";
import { AllocationCard } from "./AllocationCard";
import { ComingSoonButton } from "./ComingSoon";
import { GoalsCard } from "./GoalsCard";
import { HoldingsCard } from "./HoldingsCard";
import { InsightsCard } from "./InsightsCard";
import { MarketOverviewCard } from "./MarketOverviewCard";
import { PerformanceCard } from "./PerformanceCard";
import { PortfolioSummary } from "./PortfolioSummary";
import { SipsCard } from "./SipsCard";
import { TransactionsCard } from "./TransactionsCard";
import { useCard } from "./useCard";
import { WatchlistCard } from "./WatchlistCard";

/** Starting state per card, to render given states without effects (tests). */
export type DashboardInitial = {
  indices?: CardState<Index[]>;
  summary?: CardState<Summary>;
  performance?: CardState<Performance>;
  holdings?: CardState<Holding[]>;
  watchlist?: CardState<WatchItem[]>;
  allocation?: CardState<Allocation[]>;
  transactions?: CardState<Transaction[]>;
  goals?: CardState<Goal[]>;
  sips?: CardState<Sip[]>;
  insights?: CardState<Insight[]>;
};

export type StocksDashboardProps = {
  fetchers?: {
    [K in keyof DashboardInitial]?: () => Promise<
      DashboardInitial[K] extends CardState<infer T> | undefined ? T : never
    >;
  };
  initial?: DashboardInitial;
};

export function StocksDashboard({ fetchers = {}, initial = {} }: StocksDashboardProps) {
  const [indices, loadIndices] = useCard(fetchers.indices ?? fetchMarketOverview, initial.indices);
  const [summary, loadSummary] = useCard(fetchers.summary ?? fetchSummary, initial.summary);
  const [performance, loadPerformance] = useCard(fetchers.performance ?? fetchPerformance, initial.performance);
  const [holdings] = useCard(fetchers.holdings ?? fetchHoldings, initial.holdings);
  const [watchlist, loadWatchlist] = useCard(fetchers.watchlist ?? fetchWatchlist, initial.watchlist);
  const [allocation] = useCard(fetchers.allocation ?? fetchAllocation, initial.allocation);
  const [transactions] = useCard(fetchers.transactions ?? fetchTransactions, initial.transactions);
  const [goals] = useCard(fetchers.goals ?? fetchGoals, initial.goals);
  const [sips] = useCard(fetchers.sips ?? fetchSips, initial.sips);
  const [insights] = useCard(fetchers.insights ?? fetchInsights, initial.insights);

  return (
    <div className="stack stack-4">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <div className="cluster">
        <ComingSoonButton label="Buy" variant="primary" />
        <ComingSoonButton label="Sell" />
        <ComingSoonButton label="Add funds" />
      </div>
      <MarketOverviewCard state={indices} onRetry={loadIndices} />
      <PortfolioSummary state={summary} onRetry={loadSummary} />
      <PerformanceCard state={performance} onRetry={loadPerformance} />
      <div className="two two-wide">
        <HoldingsCard state={holdings} />
        <WatchlistCard state={watchlist} onRetry={loadWatchlist} />
      </div>
      <div className="two">
        <AllocationCard state={allocation} />
        <TransactionsCard state={transactions} />
      </div>
      <div className="two">
        <GoalsCard state={goals} />
        <SipsCard state={sips} />
      </div>
      <InsightsCard state={insights} />
    </div>
  );
}
