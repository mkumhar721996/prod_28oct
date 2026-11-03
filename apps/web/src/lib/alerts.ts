export type Alert = {
  id: string;
  kind: "money_received";
  /** Amount in minor units (cents). */
  amountMinor: number;
  /** ISO 4217 code. */
  currency: string;
  senderName: string;
  read: boolean;
  /** ISO-8601 UTC instant. */
  createdAt: string;
};

/** The top bar's unread count refreshes this often (so it can lag the real count by this much). */
export const UNREAD_REFRESH_MS = 30_000;
/** An open alerts list refetches this often, so a new alert shows well inside 10 seconds. */
export const LIST_REFRESH_MS = 5_000;

// The browser calls /api/alerts on the web origin; next.config.ts rewrites it (cookies included)
// to the API. It is under /api because /alerts is the page itself.
const ALERTS_API_PATH = "/api/alerts";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ALERTS_API_PATH}${path}`, { credentials: "include", ...init });
  if (!res.ok) throw new Error(`Alerts request failed (${res.status})`);
  return (await res.json()) as T;
}

/** Client side: the customer's alerts, newest first. Rejects on failure. */
export function fetchAlerts(): Promise<Alert[]> {
  return request<Alert[]>("");
}

/** Client side: how many alerts are unread. Rejects on failure. */
export async function fetchUnreadCount(): Promise<number> {
  return (await request<{ count: number }>("/unread-count")).count;
}

/** Client side: marks one alert read (idempotent). Rejects on failure. */
export function markAlertRead(id: string): Promise<Alert> {
  return request<Alert>(`/${encodeURIComponent(id)}/read`, { method: "POST" });
}

/** "$120.00" for 12000 USD. */
export function formatAmount(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100);
}

export function unreadIn(alerts: Alert[] | null): number {
  return alerts?.filter((a) => !a.read).length ?? 0;
}

/**
 * Runs `run` now and every `ms`, skipping ticks while `isHidden()`. Returns the stop function.
 * `run` handles its own errors, so a failed tick never stops the next one.
 */
export function startPolling(run: () => Promise<void>, ms: number, isHidden: () => boolean): () => void {
  const tick = () => {
    if (!isHidden()) void run();
  };
  tick();
  const timer = setInterval(tick, ms);
  return () => clearInterval(timer);
}

export type AlertsState = {
  /** Null until the first load succeeds. */
  alerts: Alert[] | null;
  /** The first load failed; background refreshes never set this once there is a list. */
  loadFailed: boolean;
  /** Ids with a mark-as-read in flight. */
  pending: string[];
  /** Ids whose last mark-as-read failed. */
  markFailed: string[];
};

export type AlertsAction =
  | { type: "retry" }
  | { type: "loaded"; alerts: Alert[] }
  | { type: "load-failed" }
  | { type: "mark-started"; id: string }
  | { type: "mark-done"; alert: Alert }
  | { type: "mark-failed"; id: string };

export const initialAlertsState: AlertsState = {
  alerts: null,
  loadFailed: false,
  pending: [],
  markFailed: [],
};

/** The list stays in the API's newest-first order; nothing here sorts it. */
export function alertsReducer(state: AlertsState, action: AlertsAction): AlertsState {
  switch (action.type) {
    case "retry":
      return { ...state, loadFailed: false };
    case "loaded":
      return { ...state, alerts: action.alerts, loadFailed: false };
    case "load-failed":
      return state.alerts === null ? { ...state, loadFailed: true } : state;
    case "mark-started":
      return {
        ...state,
        pending: [...state.pending, action.id],
        markFailed: state.markFailed.filter((id) => id !== action.id),
      };
    case "mark-done":
      return {
        ...state,
        alerts: state.alerts?.map((a) => (a.id === action.alert.id ? action.alert : a)) ?? null,
        pending: state.pending.filter((id) => id !== action.alert.id),
      };
    case "mark-failed":
      return {
        ...state,
        pending: state.pending.filter((id) => id !== action.id),
        markFailed: [...state.markFailed, action.id],
      };
  }
}
