import type { HistoryEntry, HistoryKind, JackpotTier } from "@/lib/session";
import { LocalTime } from "./LocalTime";

const KINDS: Record<HistoryKind, { label: string; badge: string; sign: string }> = {
  grant: { label: "Welcome bonus", badge: "badge-accent", sign: "+" },
  bet: { label: "Bet", badge: "badge-neutral", sign: "−" },
  win: { label: "Win", badge: "badge-success", sign: "+" },
  topup: { label: "Top-up", badge: "badge-info", sign: "+" },
};

const TIERS: Record<JackpotTier, string> = {
  Grand: "badge-accent",
  Major: "badge-warning",
  Minor: "badge-info",
  Mini: "badge-neutral",
};

const number =(n: number) => n.toLocaleString("en-US");

export function HistoryTable({
  entries,
  from,
  total,
}: {
  entries: HistoryEntry[];
  /** 1-based position of the first entry on this page. */
  from: number;
  total: number;
}) {
  return (
    <div className="table-wrap">
      <table className="history-table">
        <caption className="text-sm text-muted" style={{ textAlign: "left", padding: "var(--space-2)" }}>
          Showing {from} to {from + entries.length - 1} of {total} entries
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Entry</th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col" className="num">
              Jackpot contribution
            </th>
            <th scope="col">Jackpot tier</th>
            <th scope="col" className="num">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const kind = KINDS[e.kind];
            return (
              <tr key={e.id}>
                <td>
                  <LocalTime iso={e.createdAt} />
                </td>
                <td>
                  <span className={`badge ${kind.badge}`}>{kind.label}</span>
                </td>
                <td className="num">
                  {kind.sign}
                  {number(e.amountCredits)}
                </td>
                {e.kind === "bet" && e.jackpotContributionCredits !== null ? (
                  <td className="num">{e.jackpotContributionCredits.toFixed(2)}</td>
                ) : (
                  <td className="num none">
                    <span aria-hidden="true">—</span>
                    <span className="sr">No contribution</span>
                  </td>
                )}
                {e.kind === "win" && e.jackpotTier ? (
                  <td>
                    <span className={`badge ${TIERS[e.jackpotTier]}`}>{e.jackpotTier}</span>
                  </td>
                ) : (
                  <td className="none">
                    <span aria-hidden="true">—</span>
                    <span className="sr">No jackpot tier</span>
                  </td>
                )}
                <td className="num">{number(e.balanceCredits)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
