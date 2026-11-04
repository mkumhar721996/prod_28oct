"use client";

import { useCallback, useState } from "react";
import { ALERTS_CHANGED_EVENT, markAlertRead, type Alert, type MarkReadResult } from "@/lib/alerts";
import { Toast } from "../appointments/Toast";
import { AlertCard } from "./AlertCard";
import { NoAlerts } from "./NoAlerts";
import { useAlertsList } from "./useAlertPolling";

export { ALERTS_CHANGED_EVENT };
export const MARKED_READ = "Alert marked as read";
export const MARK_FAILED = "Couldn't mark this alert as read. Try again.";

export const unreadIn = (alerts: Alert[]): number => alerts.filter((a) => !a.read).length;

/** Swaps in the updated alert, keeping the list order. */
export const applyRead = (alerts: Alert[], updated: Alert): Alert[] =>
  alerts.map((a) => (a.id === updated.id ? updated : a));

type MarkOutcome = { ok: true; alert: Alert; message: string } | { ok: false; message: string };

/** Marks one alert read; on success tells the top bar to re-read its count from the API. */
export async function runMarkRead(
  id: string,
  deps: { markAlertRead: (id: string) => Promise<MarkReadResult>; notify: () => void },
): Promise<MarkOutcome> {
  const result = await deps.markAlertRead(id);
  if (!result.ok) return { ok: false, message: MARK_FAILED };
  deps.notify();
  return { ok: true, alert: result.alert, message: MARKED_READ };
}

const notifyChanged = () => window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));

export function AlertsScreen({ initialAlerts }: { initialAlerts: Alert[] }) {
  const { alerts, setAlerts } = useAlertsList(initialAlerts);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const unread = unreadIn(alerts);

  async function onMarkRead(id: string) {
    setPendingId(id);
    setErrors(({ [id]: _cleared, ...rest }) => rest);
    const outcome = await runMarkRead(id, { markAlertRead, notify: notifyChanged });
    setPendingId(null);
    if (outcome.ok) {
      setAlerts(applyRead(alerts, outcome.alert));
      setToast(outcome.message);
    } else {
      setErrors((prev) => ({ ...prev, [id]: outcome.message }));
    }
  }

  return (
    <div className="page stack stack-4">
      <div className="title-row">
        <h1>Alerts</h1>
        {unread > 0 && (
          <span className="badge badge-danger" role="status" aria-live="polite">
            {unread} unread
          </span>
        )}
      </div>
      {alerts.length === 0 ? (
        <NoAlerts />
      ) : (
        <div className="stack" aria-live="polite">
          {alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              pending={pendingId === a.id}
              error={errors[a.id] ?? null}
              onMarkRead={onMarkRead}
            />
          ))}
        </div>
      )}
      {toast && <Toast message={toast} onHide={hideToast} />}
    </div>
  );
}
