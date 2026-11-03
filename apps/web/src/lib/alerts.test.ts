import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIST_REFRESH_MS,
  UNREAD_REFRESH_MS,
  alertsReducer,
  fetchAlerts,
  fetchUnreadCount,
  formatAmount,
  initialAlertsState,
  markAlertRead,
  startPolling,
  unreadIn,
  type Alert,
} from "./alerts";

const alert = (id: string, read = false): Alert => ({
  id,
  kind: "money_received",
  amountMinor: 12000,
  currency: "USD",
  senderName: "Sam Okafor",
  read,
  createdAt: "2026-11-02T09:00:00.000Z",
});

describe("formatAmount", () => {
  it("formats minor units as currency", () => {
    expect(formatAmount(12000, "USD")).toBe("$120.00");
    expect(formatAmount(5, "USD")).toBe("$0.05");
  });
});

describe("intervals", () => {
  it("polls the count every 30 seconds and the open list well inside 10 seconds", () => {
    expect(UNREAD_REFRESH_MS).toBe(30_000);
    expect(LIST_REFRESH_MS).toBeLessThan(10_000);
  });
});

describe("api calls", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (res: { ok: boolean; status?: number; json?: unknown }) => {
    const fetch = vi.fn(async () => ({ ok: res.ok, status: res.status ?? 200, json: async () => res.json }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  };

  it("fetches the list with credentials", async () => {
    const fetch = stub({ ok: true, json: [alert("a")] });
    await expect(fetchAlerts()).resolves.toEqual([alert("a")]);
    expect(fetch).toHaveBeenCalledWith("/api/alerts", expect.objectContaining({ credentials: "include" }));
  });

  it("reads the unread count", async () => {
    stub({ ok: true, json: { count: 2 } });
    await expect(fetchUnreadCount()).resolves.toBe(2);
  });

  it("rejects on a non-2xx response", async () => {
    stub({ ok: false, status: 500 });
    await expect(fetchAlerts()).rejects.toThrow();
    await expect(fetchUnreadCount()).rejects.toThrow();
    await expect(markAlertRead("a")).rejects.toThrow();
  });

  it("marks an alert read with a POST", async () => {
    const fetch = stub({ ok: true, json: alert("a", true) });
    await expect(markAlertRead("a")).resolves.toEqual(alert("a", true));
    expect(fetch).toHaveBeenCalledWith(
      "/api/alerts/a/read",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});

describe("alertsReducer", () => {
  it("keeps the API order and counts unread", () => {
    const list = [alert("new"), alert("mid", true), alert("old")];
    const s = alertsReducer(initialAlertsState, { type: "loaded", alerts: list });
    expect(s.alerts?.map((a) => a.id)).toEqual(["new", "mid", "old"]);
    expect(unreadIn(s.alerts)).toBe(2);
  });

  it("shows a load error only when there is nothing to show yet", () => {
    expect(alertsReducer(initialAlertsState, { type: "load-failed" }).loadFailed).toBe(true);
    const loaded = alertsReducer(initialAlertsState, { type: "loaded", alerts: [alert("a")] });
    expect(alertsReducer(loaded, { type: "load-failed" }).loadFailed).toBe(false);
  });

  it("clears the error when loading again", () => {
    const failed = alertsReducer(initialAlertsState, { type: "load-failed" });
    expect(alertsReducer(failed, { type: "loaded", alerts: [] }).loadFailed).toBe(false);
    expect(alertsReducer(failed, { type: "retry" }).loadFailed).toBe(false);
  });

  it("marks one alert read: pending, then read, leaving the others unread", () => {
    let s = alertsReducer(initialAlertsState, {
      type: "loaded",
      alerts: [alert("a"), alert("b"), alert("c")],
    });
    s = alertsReducer(s, { type: "mark-started", id: "a" });
    expect(s.pending).toEqual(["a"]);
    s = alertsReducer(s, { type: "mark-done", alert: alert("a", true) });
    expect(s.pending).toEqual([]);
    expect(unreadIn(s.alerts)).toBe(2);
  });

  it("keeps the card unread and flags the failure when marking fails", () => {
    let s = alertsReducer(initialAlertsState, { type: "loaded", alerts: [alert("a")] });
    s = alertsReducer(s, { type: "mark-started", id: "a" });
    s = alertsReducer(s, { type: "mark-failed", id: "a" });
    expect(s.pending).toEqual([]);
    expect(s.markFailed).toEqual(["a"]);
    expect(unreadIn(s.alerts)).toBe(1);
    expect(alertsReducer(s, { type: "mark-started", id: "a" }).markFailed).toEqual([]);
  });
});

describe("startPolling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs at once, then every interval, until stopped", async () => {
    const run = vi.fn(async () => undefined);
    const stop = startPolling(run, 30_000, () => false);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("skips ticks while hidden", async () => {
    const run = vi.fn(async () => undefined);
    let hidden = true;
    startPolling(run, 1_000, () => hidden);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(run).not.toHaveBeenCalled();
    hidden = false;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
