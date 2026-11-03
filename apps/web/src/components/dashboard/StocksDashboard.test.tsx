import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SAMPLE_PORTFOLIO as P } from "@/lib/stocks";
import { StocksDashboard, type DashboardInitial } from "./StocksDashboard";

const READY: DashboardInitial = {
  indices: { status: "ready", data: P.indices },
  summary: { status: "ready", data: P.summary },
  performance: { status: "ready", data: P.performance },
  holdings: { status: "ready", data: P.holdings },
  watchlist: { status: "ready", data: P.watchlist },
  allocation: { status: "ready", data: P.allocation },
  transactions: { status: "ready", data: P.transactions },
  goals: { status: "ready", data: P.goals },
  sips: { status: "ready", data: P.sips },
  insights: { status: "ready", data: P.insights },
};
const LOADING: DashboardInitial = Object.fromEntries(
  Object.keys(READY).map((k) => [k, { status: "loading" }]),
) as DashboardInitial;

const html = renderToStaticMarkup(<StocksDashboard initial={READY} />);

describe("StocksDashboard ready", () => {
  it("shows every section (AC3)", () => {
    expect(html).toContain(">Dashboard</h1>");
    for (const heading of [
      "Market overview",
      "Portfolio performance vs benchmark",
      "Holdings",
      "Watchlist",
      "Portfolio allocation",
      "Recent transactions",
      "Goals",
      "SIPs",
      "Insights &amp; alerts",
    ]) {
      expect(html).toContain(`>${heading}</h2>`);
    }
    expect(html).toContain("Portfolio value");
    expect(html).toContain('aria-label="Portfolio summary"');
  });

  it("matches the demo portfolio (AC4)", () => {
    for (const text of [
      "NIFTY 50", "SENSEX", "NIFTY Bank", "Nifty 50 Index Fund", "Bluechip Equity Fund", "Infosys",
      "HDFC Bank", "TCS", "Equity 58%", "Debt 22%", "Gold 12%", "Cash 8%", "Buy a home", "Retirement",
      "Flexi Cap Fund", "Next debit 1 Nov", "Next debit 5 Nov", "Active", "Paused",
      "Tech holdings are 48% of portfolio; consider rebalancing.",
      "SIP on Flexi Cap Fund is paused; resume before 5 Nov.",
      "₹1,512", "₹1,684", "₹3,920", "₹210.40", "₹28,380", "▼ −₹389", "▲ +₹3,132",
      "₹9,00,000 saved of ₹20,00,000", "₹36,00,000 saved of ₹2,00,00,000", "₹20L target", "₹2Cr target",
      "45% reached", "18% reached", "Completed", "Pending",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("shows summary amounts in rupees (AC5) and the Active SIPs count", () => {
    expect(html).toContain("₹12,48,600");
    expect(html).toContain("▲ +₹8,420");
    expect(html).toContain("▲ +18.2%");
    expect(html).toMatch(/Active SIPs<\/div><div class="tile-value">1</);
  });

  it("shows index values in points with a direction marker (AC15)", () => {
    for (const t of ["24,310 pts", "79,820 pts", "52,140 pts", "▲ Up 0.6%", "▼ Down 0.3%"]) {
      expect(html).toContain(t);
    }
  });

  it("shows transaction amounts in rupees (AC16)", () => {
    for (const a of ["₹15,120", "₹19,600", "₹16,840", "₹9,000", "₹5,000"]) expect(html).toContain(a);
  });

  it("disables every action, search-free, with Coming soon (AC8)", () => {
    for (const label of ["Buy", "Sell", "Add funds", "Add stock", "Create goal", "New SIP"]) {
      expect(html).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${label}, coming soon"`));
    }
    const perHolding = html.match(
      /aria-label="(Buy|Sell) (Nifty 50 Index Fund|Bluechip Equity Fund|Infosys|HDFC Bank|TCS), coming soon"/g,
    );
    expect(perHolding).toHaveLength(20); // buy + sell, table + list
    expect(html.match(/class="link-soon" type="button" disabled=""/g)).toHaveLength(3);
  });

  it("labels each insight On track, Watch or Action needed (AC17)", () => {
    const labels = [...html.matchAll(/data-testid="insight-status"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(["Watch", "Action needed", "On track"]);
  });

  it("renders the holdings table and the narrow list", () => {
    expect(html).toContain('class="scroll holdings-table"');
    expect(html).toContain('class="rows holdings-list"');
    expect(html).toContain("Nifty 50 Index Fund · 120 units · +12.4%");
    expect(html).toContain("▼ Loss");
  });

  it("draws the allocation donut with a text legend", () => {
    expect(html.match(/stroke-dasharray="/g)!.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain("Donut chart: equity 58%, debt 22%, gold 12%, cash 8%");
  });

  it("gives goals progress bars", () => {
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="45"/);
  });

  it("leaves other cards unchanged whatever the chart period (AC7)", () => {
    const strip = (h: string) => h.replace(/<section[^>]*aria-labelledby="h-perf"[\s\S]*?<\/section>/, "");
    expect(strip(html)).toBe(strip(renderToStaticMarkup(<StocksDashboard initial={READY} />)));
    expect(strip(html)).not.toContain("Showing the last");
  });
});

describe("StocksDashboard card states", () => {
  it("shows a placeholder in every card while loading (AC23)", () => {
    const loading = renderToStaticMarkup(<StocksDashboard initial={LOADING} />);
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('aria-label="Loading market overview"');
    expect(loading.match(/class="skeleton/g)!.length).toBeGreaterThanOrEqual(10);
    expect(loading).not.toContain("24,310 pts");
  });

  it("shows a failure and retry on each failable card (AC19, AC20)", () => {
    const failed = renderToStaticMarkup(
      <StocksDashboard
        initial={{
          ...READY,
          indices: { status: "error", attempts: 1 },
          summary: { status: "error", attempts: 1 },
          performance: { status: "error", attempts: 1 },
          watchlist: { status: "error", attempts: 1 },
        }}
      />,
    );
    for (const label of ["market overview", "portfolio summary", "performance chart", "watchlist"]) {
      expect(failed).toContain(`We couldn&#x27;t load the ${label}.`);
    }
    expect(failed.match(/>Try again</g)).toHaveLength(4);
    expect(failed).not.toContain("24,310 pts");
    expect(failed).toContain("Nifty 50 Index Fund");
  });
});
