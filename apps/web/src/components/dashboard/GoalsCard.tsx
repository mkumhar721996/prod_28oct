import { formatRupees, formatRupeesCompact, type CardState, type Goal } from "@/lib/stocks";
import { ComingSoonButton } from "./ComingSoon";
import { DashboardCard } from "./DashboardCard";

export function GoalsCard({ state }: { state: CardState<Goal[]> }) {
  return (
    <DashboardCard label="goals" title="Goals" headingId="h-goals" state={state}>
      {state.status === "ready" && (
        <div className="stack">
          <ul className="stack plain-list">
            {state.data.map((g) => (
              <li key={g.id} className="stack stack-1">
                <div className="cluster spread">
                  <span>
                    {g.name} · {formatRupeesCompact(g.target)} target
                  </span>
                  <span>{g.percent}% reached</span>
                </div>
                <div className="text-sm text-muted">
                  {formatRupees(g.saved)} saved of {formatRupees(g.target)}
                </div>
                <div
                  className="bar"
                  role="progressbar"
                  aria-valuenow={g.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${g.name}, ${g.percent}% reached`}
                >
                  <span style={{ width: `${g.percent}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div>
            <ComingSoonButton label="Create goal" />
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
