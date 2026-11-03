import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERIOD,
  PERIODS,
  SAMPLE_PORTFOLIO,
  cardReducer,
  fetchMarketOverview,
  fetchPerformance,
  fetchSummary,
  fetchWatchlist,
  formatPoints,
  formatRupees,
  formatRupeesCompact,
  formatSigned,
  loadCard,
  nextPeriod,
  type CardAction,
  type CardState,
} from "./stocks";

describe("formatting", () => {
  it("formats rupees with Indian grouping and the ₹ symbol (AC5, AC16)", () => {
    expect(formatRupees(1248600)).toBe("₹12,48,600");
    expect(formatRupees(210.4, 2)).toBe("₹210.40");
    expect(formatRupees(5000)).toBe("₹5,000");
  });

  it("formats compact rupees in lakh and crore", () => {
    expect(formatRupeesCompact(2_000_000)).toBe("₹20L");
    expect(formatRupeesCompact(20_000_000)).toBe("₹2Cr");
    expect(formatRupeesCompact(5000)).toBe("₹5,000");
  });

  it("formats index values in points (AC15)", () => {
    expect(formatPoints(24310)).toBe("24,310 pts");
    expect(formatPoints(79820)).toBe("79,820 pts");
  });

  it("signs rupee amounts", () => {
    expect(formatSigned(8420)).toBe("+₹8,420");
    expect(formatSigned(-389)).toBe("−₹389");
  });
});

describe("periods", () => {
  it("defaults to 1M (AC18)", () => {
    expect(DEFAULT_PERIOD).toBe("1M");
    expect(PERIODS).toEqual(["1M", "6M", "1Y"]);
  });

  it("moves between periods with the arrow keys, wrapping", () => {
    expect(nextPeriod("1M", "ArrowRight")).toBe("6M");
    expect(nextPeriod("6M", "ArrowRight")).toBe("1Y");
    expect(nextPeriod("1Y", "ArrowRight")).toBe("1M");
    expect(nextPeriod("1M", "ArrowLeft")).toBe("1Y");
    expect(nextPeriod("6M", "Enter")).toBeNull();
  });
});

describe("sample data (AC4)", () => {
  it("matches the demo portfolio", () => {
    const p = SAMPLE_PORTFOLIO;
    expect(p.indices.map((i) => i.name)).toEqual(["NIFTY 50", "SENSEX", "NIFTY Bank"]);
    expect(p.summary.portfolioValue).toBe(1248600);
    expect(p.holdings).toHaveLength(5);
    expect(p.watchlist).toHaveLength(3);
    expect(p.transactions).toHaveLength(5);
    expect(p.allocation.map((a) => a.percent)).toEqual([58, 22, 12, 8]);
    expect(p.goals).toHaveLength(2);
    expect(p.sips).toHaveLength(2);
    expect(p.insights.map((i) => i.status)).toEqual(["Watch", "Action needed", "On track"]);
    expect(Object.keys(p.performance)).toEqual(["1M", "6M", "1Y"]);
  });

  it("resolves from the fetchers", async () => {
    expect(await fetchMarketOverview()).toEqual(SAMPLE_PORTFOLIO.indices);
    expect(await fetchSummary()).toEqual(SAMPLE_PORTFOLIO.summary);
    expect(await fetchPerformance()).toEqual(SAMPLE_PORTFOLIO.performance);
    expect(await fetchWatchlist()).toEqual(SAMPLE_PORTFOLIO.watchlist);
  });
});

describe("card state machine", () => {
  it("moves loading to ready when data arrives (AC24)", () => {
    expect(cardReducer({ status: "loading" }, { type: "loaded", data: SAMPLE_PORTFOLIO.indices })).toEqual({
      status: "ready",
      data: SAMPLE_PORTFOLIO.indices,
    });
  });

  it("counts failures and keeps the failure when a retry fails (AC21)", async () => {
    const dispatched: CardAction<number>[] = [];
    await loadCard(
      async () => {
        throw new Error("down");
      },
      (a) => dispatched.push(a),
    );
    expect(dispatched.at(-1)).toEqual({ type: "failed" });
    let s: CardState<number> = { status: "error", attempts: 1 };
    s = cardReducer(cardReducer(s, { type: "requested" }), { type: "failed" });
    expect(s).toEqual({ status: "error", attempts: 2 });
  });

  it("replaces the failure with the figures when a retry succeeds (AC22)", async () => {
    let s: CardState<number[]> = { status: "error", attempts: 1 };
    s = cardReducer(s, { type: "requested" });
    s = cardReducer(s, { type: "loaded", data: [1, 2] });
    expect(s).toEqual({ status: "ready", data: [1, 2] });
    const dispatched: CardAction<number>[] = [];
    await loadCard(async () => 7, (a) => dispatched.push(a));
    expect(dispatched).toEqual([{ type: "requested" }, { type: "loaded", data: 7 }]);
  });

  it("keeps the failed count visible while a retry is in flight", () => {
    expect(cardReducer({ status: "error", attempts: 1 }, { type: "requested" })).toEqual({
      status: "error",
      attempts: 1,
      retrying: true,
    });
  });
});
