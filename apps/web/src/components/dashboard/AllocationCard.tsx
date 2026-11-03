import type { Allocation, CardState } from "@/lib/stocks";
import { DashboardCard } from "./DashboardCard";

/** Each segment starts where the previous one ended; the ring starts at 12 o'clock (offset 25). */
function segments(items: Allocation[]) {
  let before = 0;
  return items.map((item) => {
    const offset = 25 - before;
    before += item.percent;
    return { ...item, offset };
  });
}

export function AllocationCard({ state }: { state: CardState<Allocation[]> }) {
  return (
    <DashboardCard label="allocation" title="Portfolio allocation" headingId="h-alloc" state={state}>
      {state.status === "ready" && (
        <div className="alloc">
          <svg
            className="donut"
            viewBox="0 0 42 42"
            role="img"
            aria-label={`Donut chart: ${state.data.map((a) => `${a.name.toLowerCase()} ${a.percent}%`).join(", ")}`}
          >
            {segments(state.data).map((s) => (
              <circle
                key={s.id}
                cx="21"
                cy="21"
                r="15.9155"
                stroke={s.color}
                strokeDasharray={`${s.percent} ${100 - s.percent}`}
                strokeDashoffset={s.offset}
              />
            ))}
          </svg>
          <ul className="stack stack-2 plain-list">
            {state.data.map((a) => (
              <li key={a.id}>
                <span className="badge badge-neutral">
                  <span className="dot" style={{ background: a.color }} />
                  {a.name} {a.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}
