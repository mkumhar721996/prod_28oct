import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/lib/session";
import { HistoryTable } from "./HistoryTable";

const entries: HistoryEntry[] = [
  { id: "4", kind: "topup", amountCredits: 500, balanceCredits: 1250, createdAt: "2026-10-28T14:30:00.000Z" },
  { id: "3", kind: "win", amountCredits: 250, balanceCredits: 750, createdAt: "2026-10-27T14:30:00.000Z" },
  { id: "2", kind: "bet", amountCredits: 100, balanceCredits: 500, createdAt: "2026-10-26T14:30:00.000Z" },
  { id: "1", kind: "grant", amountCredits: 1000, balanceCredits: 1000, createdAt: "2026-10-25T14:30:00.000Z" },
];

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
    expect(html.match(/<th scope="col"/g)).toHaveLength(4);
  });
});
