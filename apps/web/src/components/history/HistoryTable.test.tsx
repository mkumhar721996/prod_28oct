import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/lib/session";
import { HistoryTable } from "./HistoryTable";

const none = { jackpotContributionCredits: null, jackpotTier: null };
const entries: HistoryEntry[] = [
  { id: "4", kind: "topup", amountCredits: 500, balanceCredits: 1250, createdAt: "2026-10-28T14:30:00.000Z", ...none },
  { id: "3", kind: "win", amountCredits: 250, balanceCredits: 750, createdAt: "2026-10-27T14:30:00.000Z", ...none },
  { id: "2", kind: "bet", amountCredits: 100, balanceCredits: 500, createdAt: "2026-10-26T14:30:00.000Z", ...none },
  { id: "1", kind: "grant", amountCredits: 1000, balanceCredits: 1000, createdAt: "2026-10-25T14:30:00.000Z", ...none },
];

const bet = (id: string, contribution: number | null): HistoryEntry => ({
  id,
  kind: "bet",
  amountCredits: 10,
  balanceCredits: 90,
  createdAt: "2026-10-26T14:30:00.000Z",
  jackpotContributionCredits: contribution,
  jackpotTier: null,
});
const tiers = ["Grand", "Major", "Minor", "Mini"] as const;
const win = (tier: (typeof tiers)[number] | null): HistoryEntry => ({
  id: `w-${tier}`,
  kind: "win",
  amountCredits: 10,
  balanceCredits: 90,
  createdAt: "2026-10-26T14:30:00.000Z",
  jackpotContributionCredits: null,
  jackpotTier: tier,
});

describe("HistoryTable", () => {
  const html = renderToStaticMarkup(<HistoryTable entries={entries} from={1} total={4} />);

  it("lists one row per entry with a kind badge, signed amount, balance and time", () => {
    expect(html.match(/<tr>/g)).toHaveLength(5);
    expect(html).toContain('<span class="badge badge-info">Top-up</span>');
    expect(html).toContain('<span class="badge badge-success">Win</span>');
    expect(html).toContain('<span class="badge badge-neutral">Bet</span>');
    expect(html).toContain('<span class="badge badge-accent">Welcome bonus</span>');
    expect(html).toContain("−100");
    expect(html).toContain("+500");
    expect(html).toContain(">1,250<");
    expect(html).toContain('dateTime="2026-10-28T14:30:00.000Z"');
  });

  it("has a caption and scoped column headers", () => {
    expect(html).toContain("Showing 1 to 4 of 4 entries");
    expect(html.match(/<th scope="col"/g)).toHaveLength(6);
    expect(html).toContain("Jackpot contribution");
    expect(html).toContain("Jackpot tier");
  });

  it("AC1/2/6/7: a bet shows its jackpot contribution to two decimals", () => {
    const h = renderToStaticMarkup(
      <HistoryTable entries={[bet("a", 0.05), bet("b", 2.5), bet("c", 1)]} from={1} total={3} />,
    );
    expect(h).toContain(">0.05<");
    expect(h).toContain(">2.50<");
    expect(h).toContain(">1.00<");
  });

  it("shows a dash and text for a bet with no contribution", () => {
    const h = renderToStaticMarkup(<HistoryTable entries={[bet("a", null)]} from={1} total={1} />);
    expect(h).toContain("No contribution");
  });

  it("AC3/4: each jackpot tier shows as a badge with its name", () => {
    const h = renderToStaticMarkup(<HistoryTable entries={tiers.map(win)} from={1} total={4} />);
    for (const tier of tiers) expect(h).toContain(`>${tier}</span>`);
    expect(h).not.toContain("No jackpot tier");
  });

  it("AC5: a win that is not a jackpot win shows no tier", () => {
    const h = renderToStaticMarkup(<HistoryTable entries={[win(null)]} from={1} total={1} />);
    expect(h).not.toMatch(/Grand|Major|Minor|Mini/);
    expect(h).toContain("No jackpot tier");
  });
});
