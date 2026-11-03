import { formatRupees, type CardState, type Sip } from "@/lib/stocks";
import { ComingSoonButton } from "./ComingSoon";
import { DashboardCard } from "./DashboardCard";

export function SipsCard({ state }: { state: CardState<Sip[]> }) {
  return (
    <DashboardCard label="SIPs" title="SIPs" headingId="h-sips" state={state}>
      {state.status === "ready" && (
        <div className="stack">
          <ul className="rows">
            {state.data.map((s) => (
              <li key={s.id}>
                <span>
                  {s.name} · {formatRupees(s.amount)} monthly
                  <br />
                  <span className="text-sm text-muted">Next debit {s.nextDebit}</span>
                </span>
                <span className={`badge ${s.status === "Active" ? "badge-success" : "badge-warning"}`}>
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <ComingSoonButton label="New SIP" variant="primary" />
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
