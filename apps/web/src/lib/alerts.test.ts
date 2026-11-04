import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALERTS_POLL_MS,
  UNREAD_POLL_MS,
  fetchAlerts,
  fetchUnreadCount,
  formatAmount,
  markAlertRead,
} from "./alerts";
import { signInTarget } from "./shell";

const alert = {
  id: "1",
  kind: "money_received",
  amountMinor: 12000,
  currency: "USD",
  senderName: "Sam Okafor",
  createdAt: "2026-11-04T10:00:00.000Z",
  read: false,
};

function respond(status: number, body: unknown) {
  return vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
}

afterEach(() => vi.unstubAllGlobals());

describe("polling cadence", () => {
  it("refreshes the count every 30s and the list well inside 10s", () => {
    expect(UNREAD_POLL_MS).toBe(30_000);
    expect(ALERTS_POLL_MS).toBeLessThanOrEqual(5_000);
  });
});

describe("sign-in target", () => {
  it("sends a signed-out visitor back to the alerts page", () => {
    expect(signInTarget("alerts")).toBe("/alerts");
  });
});

describe("formatAmount", () => {
  it("formats minor units as currency", () => {
    expect(formatAmount(12000, "USD")).toContain("120.00");
    expect(formatAmount(5, "USD")).toContain("0.05");
  });
});

describe("fetchUnreadCount", () => {
  it("returns the count", async () => {
    const f = respond(200, { unreadCount: 3 });
    vi.stubGlobal("fetch", f);
    await expect(fetchUnreadCount()).resolves.toEqual({ ok: true, unreadCount: 3 });
    expect(f.mock.calls[0][0]).toBe("/api/alerts/unread-count");
  });

  it("never throws", async () => {
    vi.stubGlobal("fetch", respond(500, {}));
    await expect(fetchUnreadCount()).resolves.toEqual({ ok: false });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(fetchUnreadCount()).resolves.toEqual({ ok: false });
  });
});

describe("fetchAlerts", () => {
  it("returns the alerts", async () => {
    const f = respond(200, { alerts: [alert] });
    vi.stubGlobal("fetch", f);
    await expect(fetchAlerts()).resolves.toEqual({ ok: true, alerts: [alert] });
    expect(f.mock.calls[0][0]).toBe("/api/alerts");
  });

  it("reports failure without throwing", async () => {
    vi.stubGlobal("fetch", respond(401, {}));
    await expect(fetchAlerts()).resolves.toEqual({ ok: false });
  });
});

describe("markAlertRead", () => {
  it("posts to the alert's read endpoint", async () => {
    const f = respond(200, { ...alert, read: true });
    vi.stubGlobal("fetch", f);
    await expect(markAlertRead("1")).resolves.toEqual({ ok: true, alert: { ...alert, read: true } });
    expect(f.mock.calls[0][0]).toBe("/api/alerts/1/read");
    expect(f.mock.calls[0][1]?.method).toBe("POST");
  });

  it("reports failure without throwing", async () => {
    vi.stubGlobal("fetch", respond(404, {}));
    await expect(markAlertRead("1")).resolves.toEqual({ ok: false });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(markAlertRead("1")).resolves.toEqual({ ok: false });
  });
});
