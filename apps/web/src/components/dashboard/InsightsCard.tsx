import type { CardState, Insight, InsightStatus } from "@/lib/stocks";
import { ComingSoonLink } from "./ComingSoon";
import { DashboardCard } from "./DashboardCard";

const BADGE: Record<InsightStatus, string> = {
  "On track": "badge-success",
  Watch: "badge-info",
  "Action needed": "badge-warning",
};

export function InsightsCard({ state }: { state: CardState<Insight[]> }) {
  return (
    <DashboardCard label="insights" title="Insights & alerts" headingId="h-ins" state={state}>
      {state.status === "ready" && (
        <div className="insights">
          {state.data.map((insight) => (
            <div key={insight.id} className="card insight">
              <div>
                <span className={`badge ${BADGE[insight.status]}`} data-testid="insight-status">
                  {insight.status}
                </span>
              </div>
              <p>{insight.text}</p>
              <div>
                <ComingSoonLink label={insight.action} />
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
