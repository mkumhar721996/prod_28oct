export type Period = "1M" | "6M" | "1Y";
export const PERIODS: readonly Period[] = ["1M", "6M", "1Y"];
export const DEFAULT_PERIOD: Period = "1M";

const MINUS = "−";

/** "₹12,48,600": Indian digit grouping with the rupee symbol. */
export function formatRupees(n: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** Lakh and crore for round targets: 2_000_000 -> "₹20L", 20_000_000 -> "₹2Cr". */
export function formatRupeesCompact(n: number): string {
  if (n >= 10_000_000) return `₹${n / 10_000_000}Cr`;
  if (n >= 100_000) return `₹${n / 100_000}L`;
  return formatRupees(n);
}

export function formatPoints(n: number): string {
  return `${new Intl.NumberFormat("en-IN").format(n)} pts`;
}

/** "+₹8,420" or "−₹389" (true minus sign). */
export function formatSigned(n: number, fractionDigits = 0): string {
  return `${n < 0 ? MINUS : "+"}${formatRupees(Math.abs(n), fractionDigits)}`;
}

/** "0.6%" without a sign; the caller adds the ▲/▼ marker. */
export function formatPercent(n: number): string {
  return `${Math.abs(n)}%`;
}

/** "+12.4%" or "−2.1%". */
export function formatSignedPercent(n: number): string {
  return `${n < 0 ? MINUS : "+"}${Math.abs(n)}%`;
}

/** Left/Right arrow moves between the period tabs, wrapping; any other key is not a move. */
export function nextPeriod(current: Period, key: string): Period | null {
  const step = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  if (step === 0) return null;
  return PERIODS[(PERIODS.indexOf(current) + step + PERIODS.length) % PERIODS.length];
}

export type CardState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; attempts: number; retrying?: boolean };

export type CardAction<T> = { type: "requested" } | { type: "loaded"; data: T } | { type: "failed" };

export function cardReducer<T>(state: CardState<T>, action: CardAction<T>): CardState<T> {
  switch (action.type) {
    case "requested":
      return state.status === "error" ? { ...state, retrying: true } : { status: "loading" };
    case "failed":
      return { status: "error", attempts: state.status === "error" ? state.attempts + 1 : 1 };
    case "loaded":
      return { status: "ready", data: action.data };
  }
}

/** One load attempt: used for the first load and for Try again. */
export async function loadCard<T>(
  fetcher: () => Promise<T>,
  dispatch: (action: CardAction<T>) => void,
): Promise<void> {
  dispatch({ type: "requested" });
  try {
    dispatch({ type: "loaded", data: await fetcher() });
  } catch {
    dispatch({ type: "failed" });
  }
}

export type Index = { id: string; name: string; points: number; changePercent: number };

export type Summary = {
  portfolioValue: number;
  todaysPnl: number;
  totalReturnPercent: number;
  activeSips: number;
};

/** Chart drawing data, in the 544 x 220 viewBox of the approved prototype. */
export type PerformanceSeries = {
  /** Axis line (the zero line) is flagged; the rest are plain grid lines. */
  gridLines: { y: number; axis?: true }[];
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  benchmarkPoints: string;
  portfolioPoints: string;
  portfolioEnd: number;
  benchmarkEnd: number;
  portfolioLabel: { text: string; y: number };
  benchmarkLabel: { text: string; y: number };
  note: string;
};

export type Performance = Record<Period, PerformanceSeries>;

export type Holding = {
  id: string;
  name: string;
  quantity: number;
  unit: "units" | "shares";
  avgCost: number;
  value: number;
  pnl: number;
  changePercent: number;
  /** Return since purchase, shown in the narrow list. */
  returnPercent: number;
};

export type WatchItem = { id: string; name: string; price: number; changePercent: number };

export type Allocation = { id: string; name: string; percent: number; color: string };

export type Transaction = {
  id: string;
  date: string;
  stock: string;
  type: "Buy" | "Sell" | "SIP";
  amount: number;
  status: "Completed" | "Pending";
};

export type Goal = { id: string; name: string; target: number; saved: number; percent: number };

export type Sip = {
  id: string;
  name: string;
  amount: number;
  nextDebit: string;
  status: "Active" | "Paused";
};

export type InsightStatus = "On track" | "Watch" | "Action needed";
export type Insight = { id: string; status: InsightStatus; text: string; action: string };

export type Portfolio = {
  indices: Index[];
  summary: Summary;
  performance: Performance;
  holdings: Holding[];
  watchlist: WatchItem[];
  allocation: Allocation[];
  transactions: Transaction[];
  goals: Goal[];
  sips: Sip[];
  insights: Insight[];
};

/**
 * Demo portfolio, copied from the approved prototype (the figures are not reconciled with each
 * other). No stocks API exists yet; the fetchers below resolve this set (same pattern as SAMPLE_GAMES).
 */
export const SAMPLE_PORTFOLIO: Portfolio = {
  indices: [
    { id: "nifty-50", name: "NIFTY 50", points: 24310, changePercent: 0.6 },
    { id: "sensex", name: "SENSEX", points: 79820, changePercent: 0.5 },
    { id: "nifty-bank", name: "NIFTY Bank", points: 52140, changePercent: -0.3 },
  ],
  summary: { portfolioValue: 1248600, todaysPnl: 8420, totalReturnPercent: 18.2, activeSips: 1 },
  performance: {
    "1M": {
      gridLines: [
        { y: 20 },
        { y: 52 },
        { y: 84 },
        { y: 116 },
        { y: 148, axis: true },
        { y: 180 },
      ],
      yTicks: [
        { y: 24, label: "4%" },
        { y: 56, label: "3%" },
        { y: 88, label: "2%" },
        { y: 120, label: "1%" },
        { y: 152, label: "0%" },
        { y: 184, label: "-1%" },
      ],
      xTicks: [
        { x: 48, label: "1 Oct" },
        { x: 144, label: "7 Oct" },
        { x: 240, label: "13 Oct" },
        { x: 336, label: "19 Oct" },
        { x: 432, label: "25 Oct" },
        { x: 520, label: "29 Oct" },
      ],
      benchmarkPoints: "48,148 144,135.2 240,141.6 336,112.8 432,116 528,90.4",
      portfolioPoints: "48,148 144,122.4 240,132 336,87.2 432,64.8 528,39.2",
      portfolioEnd: 39.2,
      benchmarkEnd: 90.4,
      portfolioLabel: { text: "Portfolio +3.4%", y: 30 },
      benchmarkLabel: { text: "NIFTY 50 +1.8%", y: 108 },
      note: "Showing the last month, 1 Oct to 29 Oct.",
    },
    "6M": {
      gridLines: [{ y: 20 }, { y: 65.7 }, { y: 111.4 }, { y: 157.1, axis: true }],
      yTicks: [
        { y: 24, label: "12%" },
        { y: 70, label: "8%" },
        { y: 115, label: "4%" },
        { y: 161, label: "0%" },
      ],
      xTicks: [
        { x: 48, label: "May" },
        { x: 144, label: "Jun" },
        { x: 240, label: "Jul" },
        { x: 336, label: "Aug" },
        { x: 432, label: "Sep" },
        { x: 520, label: "Oct" },
      ],
      benchmarkPoints: "48,162.9 144,143.4 240,150.3 336,112.6 432,95.4 528,79.4",
      portfolioPoints: "48,168.6 144,128.6 240,136.6 336,93.1 432,66.9 528,50.9",
      portfolioEnd: 50.9,
      benchmarkEnd: 79.4,
      portfolioLabel: { text: "Portfolio +9.3%", y: 40 },
      benchmarkLabel: { text: "NIFTY 50 +6.8%", y: 98 },
      note: "Showing the last six months, May to Oct.",
    },
    "1Y": {
      gridLines: [{ y: 20 }, { y: 60 }, { y: 100 }, { y: 140 }, { y: 180, axis: true }],
      yTicks: [
        { y: 24, label: "20%" },
        { y: 64, label: "15%" },
        { y: 104, label: "10%" },
        { y: 144, label: "5%" },
        { y: 184, label: "0%" },
      ],
      xTicks: [
        { x: 48, label: "Nov" },
        { x: 144, label: "Jan" },
        { x: 240, label: "Mar" },
        { x: 336, label: "Jun" },
        { x: 432, label: "Aug" },
        { x: 520, label: "Oct" },
      ],
      benchmarkPoints: "48,180 144,164 240,173.6 336,135.2 432,114.4 528,92.8",
      portfolioPoints: "48,180 144,155.2 240,162.4 336,117.6 432,88 528,63.2",
      portfolioEnd: 63.2,
      benchmarkEnd: 92.8,
      portfolioLabel: { text: "Portfolio +14.6%", y: 54 },
      benchmarkLabel: { text: "NIFTY 50 +10.9%", y: 112 },
      note: "Showing the last year, Nov to Oct.",
    },
  },
  holdings: [
    { id: "nifty-fund", name: "Nifty 50 Index Fund", quantity: 120, unit: "units", avgCost: 210.4, value: 28380, pnl: 3132, changePercent: 0.6, returnPercent: 12.4 },
    { id: "bluechip-fund", name: "Bluechip Equity Fund", quantity: 45, unit: "units", avgCost: 412, value: 18151, pnl: -389, changePercent: -0.4, returnPercent: -2.1 },
    { id: "infosys", name: "Infosys", quantity: 30, unit: "shares", avgCost: 1380, value: 45360, pnl: 3960, changePercent: 1.2, returnPercent: 9.6 },
    { id: "hdfc-bank", name: "HDFC Bank", quantity: 25, unit: "shares", avgCost: 1650, value: 42100, pnl: 850, changePercent: -0.4, returnPercent: 2.1 },
    { id: "tcs", name: "TCS", quantity: 10, unit: "shares", avgCost: 3610, value: 39200, pnl: 3100, changePercent: 0.8, returnPercent: 8.6 },
  ],
  watchlist: [
    { id: "infosys", name: "Infosys", price: 1512, changePercent: 1.2 },
    { id: "hdfc-bank", name: "HDFC Bank", price: 1684, changePercent: -0.4 },
    { id: "tcs", name: "TCS", price: 3920, changePercent: 0.8 },
  ],
  allocation: [
    { id: "equity", name: "Equity", percent: 58, color: "var(--color-primary)" },
    { id: "debt", name: "Debt", percent: 22, color: "var(--color-accent)" },
    { id: "gold", name: "Gold", percent: 12, color: "var(--color-secondary)" },
    { id: "cash", name: "Cash", percent: 8, color: "var(--color-neutral-500)" },
  ],
  transactions: [
    { id: "t1", date: "29 Oct", stock: "Infosys", type: "Buy", amount: 15120, status: "Completed" },
    { id: "t2", date: "28 Oct", stock: "TCS", type: "Sell", amount: 19600, status: "Completed" },
    { id: "t3", date: "25 Oct", stock: "HDFC Bank", type: "Buy", amount: 16840, status: "Completed" },
    { id: "t4", date: "21 Oct", stock: "Bluechip Equity Fund", type: "Buy", amount: 9000, status: "Pending" },
    { id: "t5", date: "1 Oct", stock: "Nifty 50 Index Fund", type: "SIP", amount: 5000, status: "Completed" },
  ],
  goals: [
    { id: "home", name: "Buy a home", target: 2_000_000, saved: 900_000, percent: 45 },
    { id: "retirement", name: "Retirement", target: 20_000_000, saved: 3_600_000, percent: 18 },
  ],
  sips: [
    { id: "nifty-sip", name: "Nifty 50 Index Fund", amount: 5000, nextDebit: "1 Nov", status: "Active" },
    { id: "flexi-sip", name: "Flexi Cap Fund", amount: 3000, nextDebit: "5 Nov", status: "Paused" },
  ],
  insights: [
    { id: "rebalance", status: "Watch", text: "Tech holdings are 48% of portfolio; consider rebalancing.", action: "Review" },
    { id: "resume-sip", status: "Action needed", text: "SIP on Flexi Cap Fund is paused; resume before 5 Nov.", action: "Resume SIP" },
    { id: "bank-fall", status: "On track", text: "NIFTY Bank fell 0.3% today; your bank holdings are down ₹1,240.", action: "View holdings" },
  ],
};

/** Resolve the sample set; a real API can replace these without touching the UI. */
export async function fetchMarketOverview(): Promise<Index[]> {
  return SAMPLE_PORTFOLIO.indices.slice();
}

export async function fetchSummary(): Promise<Summary> {
  return { ...SAMPLE_PORTFOLIO.summary };
}

export async function fetchPerformance(): Promise<Performance> {
  return { ...SAMPLE_PORTFOLIO.performance };
}

export async function fetchWatchlist(): Promise<WatchItem[]> {
  return SAMPLE_PORTFOLIO.watchlist.slice();
}

export async function fetchHoldings(): Promise<Holding[]> {
  return SAMPLE_PORTFOLIO.holdings.slice();
}

export async function fetchAllocation(): Promise<Allocation[]> {
  return SAMPLE_PORTFOLIO.allocation.slice();
}

export async function fetchTransactions(): Promise<Transaction[]> {
  return SAMPLE_PORTFOLIO.transactions.slice();
}

export async function fetchGoals(): Promise<Goal[]> {
  return SAMPLE_PORTFOLIO.goals.slice();
}

export async function fetchSips(): Promise<Sip[]> {
  return SAMPLE_PORTFOLIO.sips.slice();
}

export async function fetchInsights(): Promise<Insight[]> {
  return SAMPLE_PORTFOLIO.insights.slice();
}
