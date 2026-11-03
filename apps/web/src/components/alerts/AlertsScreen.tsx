"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import {
  LIST_REFRESH_MS,
  alertsReducer,
  fetchAlerts,
  initialAlertsState,
  markAlertRead,
  startPolling,
  unreadIn,
  type AlertsState,
} from "@/lib/alerts";
import { Toast } from "../appointments/Toast";
import { Icon } from "../orders/Icon";
import { AlertCard } from "./AlertCard";
import { NoAlerts } from "./NoAlerts";
import { useUnreadCount } from "./UnreadCountProvider";

type Props = {
  /** Starting state, for rendering a given state without effects (tests). */
  initial?: AlertsState;
};

export function AlertsScreen({ initial = initialAlertsState }: Props) {
  const [state, dispatch] = useReducer(alertsReducer, initial);
  const [toast, setToast] = useState(false);
  const { setCount } = useUnreadCount();
  const hideToast = useCallback(() => setToast(false), []);

  const load = useCallback(
    () =>
      fetchAlerts().then(
        (alerts) => dispatch({ type: "loaded", alerts }),
        () => dispatch({ type: "load-failed" }),
      ),
    [],
  );

  // Loads on open and refetches so a new alert appears without a manual reload.
  useEffect(() => startPolling(load, LIST_REFRESH_MS, () => document.hidden), [load]);

  const unread = unreadIn(state.alerts);
  // The list is every alert the customer has, so its unread total is the top bar's count too.
  useEffect(() => {
    if (state.alerts !== null) setCount(unread);
  }, [state.alerts, unread, setCount]);

  async function markRead(id: string) {
    dispatch({ type: "mark-started", id });
    try {
      dispatch({ type: "mark-done", alert: await markAlertRead(id) });
      setToast(true);
    } catch {
      dispatch({ type: "mark-failed", id });
    }
  }

  function retry() {
    dispatch({ type: "retry" });
    void load();
  }

  return (
    <div className="page stack stack-4">
      <div className="title-row">
        <h1>Alerts</h1>
        <span role="status" aria-live="polite">
          {unread > 0 && <span className="badge badge-danger">{unread} unread</span>}
        </span>
      </div>
      {state.loadFailed ? (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <span>We couldn&apos;t load your alerts. Check your connection and try again.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>
            Try again
          </button>
        </div>
      ) : state.alerts === null ? (
        <div className="stack" aria-hidden="true">
          <span className="skeleton alert-skeleton" />
          <span className="skeleton alert-skeleton" />
        </div>
      ) : state.alerts.length === 0 ? (
        <NoAlerts />
      ) : (
        <div className="stack">
          {state.alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              pending={state.pending.includes(a.id)}
              failed={state.markFailed.includes(a.id)}
              onMarkRead={markRead}
            />
          ))}
        </div>
      )}
      {toast && <Toast message="Alert marked as read" onHide={hideToast} />}
    </div>
  );
}
