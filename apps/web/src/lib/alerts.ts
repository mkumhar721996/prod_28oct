import { cookies } from "next/headers";

type AlertBase = {
  id: string;
  /** ISO-8601 UTC. */
  createdAt: string;
  read: boolean;
};

export type MoneyAlert = AlertBase & {
  kind: "money_received";
  /** Minor units (cents) of `currency`. */
  amountMinor: number;
  currency: string;
  senderName: string;
};

/** A staff decision on the customer's ID details; carries no money. */
export type IdentityAlert = AlertBase & {
  kind: "identity_approved" | "identity_rejected";
  amountMinor: null;
  currency: null;
  senderName: null;
};

export type Alert = MoneyAlert | IdentityAlert;

export type UnreadResult = { ok: true; unreadCount: number } | { ok: false };
export type AlertsResult = { ok: true; alerts: Alert[] } | { ok: false };
export type MarkReadResult = { ok: true; alert: Alert } | { ok: false };

/** The top-bar count refreshes about every 30s; the open list polls faster so a new alert shows within 10s. */
export const UNREAD_POLL_MS = 30_000;
export const ALERTS_POLL_MS = 5_000;

/** Fired on window when an alert changes, so the top-bar count re-reads at once instead of waiting for its poll. */
export const ALERTS_CHANGED_EVENT = "alerts:changed";

// The browser calls /api/alerts on the web origin; next.config.ts rewrites it (cookies included)
// to the API. It is under /api because /alerts is the page itself.
const ALERTS_API_PATH = "/api/alerts";
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";

/** Server side: the signed-in player's own alerts, newest first. Throws if they cannot be read. */
export async function getAlerts(): Promise<Alert[]> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}/alerts`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`Alerts lookup failed (${res.status})`);
  return ((await res.json()) as { alerts: Alert[] }).alerts;
}

/** "$120.00" from 12000 and "USD", in the reader's locale. */
export function formatAmount(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
}

/** Browser side. Never throws: a failed poll is `{ ok: false }` so the caller keeps its last value. */
export async function fetchUnreadCount(): Promise<UnreadResult> {
  try {
    const res = await fetch(`${ALERTS_API_PATH}/unread-count`, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    return { ok: true, unreadCount: ((await res.json()) as { unreadCount: number }).unreadCount };
  } catch {
    return { ok: false };
  }
}

export async function fetchAlerts(): Promise<AlertsResult> {
  try {
    const res = await fetch(ALERTS_API_PATH, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    return { ok: true, alerts: ((await res.json()) as { alerts: Alert[] }).alerts };
  } catch {
    return { ok: false };
  }
}

export async function markAlertRead(id: string): Promise<MarkReadResult> {
  try {
    const res = await fetch(`${ALERTS_API_PATH}/${encodeURIComponent(id)}/read`, { method: "POST" });
    if (!res.ok) return { ok: false };
    return { ok: true, alert: (await res.json()) as Alert };
  } catch {
    return { ok: false };
  }
}
