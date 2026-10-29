import { HISTORY_HREF, PLACE_BET_HREF } from "@/lib/shell";
import type { WalletHistory } from "@/lib/session";
import { HistoryTable } from "./HistoryTable";

const PAGE_SIZE = 10;

const VIEWS: { id: WalletHistory["view"]; label: string }[] = [
  { id: "wallet", label: "Wallet transactions" },
  { id: "play", label: "Play history" },
];

function href(page: number, range: WalletHistory["range"], view: WalletHistory["view"]): string {
  const query = new URLSearchParams();
  if (view === "play") query.set("view", "play");
  if (range === "all") query.set("range", "all");
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${HISTORY_HREF}?${text}` : HISTORY_HREF;
}

export function HistoryScreen({ history }: { history: WalletHistory }) {
  const { entries, page, pageCount, total, range, view } = history;
  const all = range === "all";
  return (
    <div className="narrow stack stack-4">
      <h1>{VIEWS.find((v) => v.id === view)?.label}</h1>
      <div className="tabs" role="tablist" aria-label="History views">
        {VIEWS.map((v) => (
          <a
            key={v.id}
            className="tab"
            role="tab"
            aria-selected={v.id === view}
            href={href(1, "recent", v.id)}
          >
            {v.label}
          </a>
        ))}
      </div>
      <p className="text-muted">
        {all
          ? "All entries, most recent first."
          : "Entries from the last 30 days, most recent first."}
      </p>
      {total === 0 ? (
        <div className="empty-state">
          <h2>No entries yet</h2>
          <p>Place a bet and it shows up here with your new balance.</p>
          <a className="btn btn-primary" href={PLACE_BET_HREF}>
            Place a bet
          </a>
        </div>
      ) : (
        <>
          <HistoryTable entries={entries} from={(page - 1) * PAGE_SIZE + 1} total={total} />
          <nav className="pager" aria-label="History pages">
            <a
              className="btn btn-ghost"
              href={href(1, range, view)}
              aria-disabled={page === 1 ? "true" : undefined}
            >
              Most recent
            </a>
            <span className="text-sm text-muted">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <a className="btn btn-secondary" href={href(page + 1, range, view)}>
                Older entries
              </a>
            ) : (
              <button type="button" className="btn btn-secondary" disabled>
                No older entries
              </button>
            )}
          </nav>
        </>
      )}
      <div>
        <a className="btn btn-ghost" href={href(1, all ? "recent" : "all", view)}>
          {all ? "Show last 30 days" : "Show all entries"}
        </a>
      </div>
    </div>
  );
}
