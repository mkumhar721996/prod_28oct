import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HistoryEntry, WalletHistory } from "@/lib/session";
import { HistoryScreen } from "./HistoryScreen";

const entry = (id: number): HistoryEntry => ({
  id: String(id),
  kind: "bet",
  amountCredits: 10,
  balanceCredits: 990,
  createdAt: "2026-10-28T14:30:00.000Z",
  jackpotContributionCredits: null,
  jackpotTier: null,
});

const history = (over: Partial<WalletHistory> = {}): WalletHistory => ({
  entries: Array.from({ length: 10 }, (_, i) => entry(i)),
  page: 1,
  pageCount: 3,
  total: 24,
  range: "recent",
  view: "wallet",
  ...over,
});

const render = (h: WalletHistory) => renderToStaticMarkup(<HistoryScreen history={h} />);

describe("HistoryScreen", () => {
  it("shows the most recent page with an Older entries link and the window note", () => {
    const html = render(history());
    expect(html).toContain("<h1>Wallet transactions</h1>");
    expect(html).toContain("Entries from the last 30 days, most recent first.");
    expect(html).toMatch(/<a class="btn btn-secondary" href="\/history\?page=2">Older entries<\/a>/);
    expect(html).toContain("Page 1 of 3");
    expect(html).toMatch(/aria-disabled="true">Most recent</);
    expect(html).toMatch(/href="\/history\?range=all">Show all entries</);
  });

  it("disables Older entries on the last page", () => {
    const html = render(history({ page: 3, pageCount: 3 }));
    expect(html).not.toMatch(/<a[^>]*>Older entries/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>No older entries<\/button>/);
  });

  it("keeps the range in the paging links of the all view", () => {
    const html = render(history({ range: "all" }));
    expect(html).toContain("All entries, most recent first.");
    expect(html).toMatch(/href="\/history\?range=all&amp;page=2">Older entries</);
    expect(html).toMatch(/href="\/history">Show last 30 days</);
  });

  it("has tabs for both views, with the active one selected", () => {
    const wallet = render(history());
    expect(wallet).toContain('role="tablist"');
    expect(wallet).toMatch(/<a class="tab" role="tab" aria-selected="true" href="\/history">/);
    expect(wallet).toContain('href="/history?view=play"');
    const play = render(history({ view: "play" }));
    expect(play).toContain("<h1>Play history</h1>");
    expect(play).toMatch(/aria-selected="true" href="\/history\?view=play"/);
  });

  it("keeps the view in the paging and range links", () => {
    const html = render(history({ view: "play" }));
    expect(html).toContain('href="/history?view=play&amp;page=2"');
    expect(html).toContain('href="/history?view=play&amp;range=all"');
  });

  it("shows an empty state that points at Place a bet", () => {
    const html = render(history({ entries: [], total: 0, pageCount: 1 }));
    expect(html).toContain("No entries yet");
    expect(html).toMatch(/href="\/wallet">Place a bet</);
    expect(html).not.toContain("<table");
  });
});
