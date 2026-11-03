import type { ReactNode } from "react";
import type { CardState } from "@/lib/stocks";
import { Icon } from "../orders/Icon";

type DashboardCardProps = {
  /** Lower-case name used in the loading and failure text, e.g. "market overview". */
  label: string;
  /** Visible heading; without one the section is named by `label` and has no card frame. */
  title?: string;
  headingId?: string;
  state: CardState<unknown>;
  /** Present on the cards that can fail. */
  onRetry?: () => void;
  children: ReactNode;
};

/** The one place the loading placeholder, failure message and retry prompt live. */
export function DashboardCard({ label, title, headingId, state, onRetry, children }: DashboardCardProps) {
  const named = title !== undefined;
  return (
    <section
      className={named ? "card" : undefined}
      aria-labelledby={named ? headingId : undefined}
      aria-label={named ? undefined : label.charAt(0).toUpperCase() + label.slice(1)}
    >
      {named && (
        <h2 id={headingId} className="section-head">
          {title}
        </h2>
      )}
      {state.status === "loading" && (
        <div aria-busy="true">
          <div className="skel" role="status" aria-label={`Loading ${label}`}>
            <span className="skeleton tall" />
            <span className="skeleton" />
            <span className="skeleton" />
          </div>
        </div>
      )}
      {state.status === "error" && (
        <div className="failed">
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <span>
              {state.attempts > 1
                ? `Still couldn't load the ${label}. Try again in a moment.`
                : `We couldn't load the ${label}. Check your connection, then try again.`}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRetry}
            disabled={state.retrying}
          >
            {state.retrying ? (
              <>
                <span className="spinner" aria-hidden="true" /> Trying again
              </>
            ) : (
              "Try again"
            )}
          </button>
        </div>
      )}
      {state.status === "ready" && children}
    </section>
  );
}
