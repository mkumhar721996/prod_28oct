import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Alert } from "@/lib/alerts";
import {
  ALERTS_CHANGED_EVENT,
  AlertsScreen,
  MARK_FAILED,
  MARKED_READ,
  applyRead,
  runMarkRead,
  unreadIn,
} from "./AlertsScreen";

const make = (id: string, read = false): Alert => ({
  id,
  kind: "money_received",
  amountMinor: 1000 * Number(id),
  currency: "USD",
  senderName: `Sender ${id}`,
  createdAt: "2026-11-04T10:00:00.000Z",
  read,
});

describe("unreadIn / applyRead", () => {
  it("counts the unread alerts", () => {
    expect(unreadIn([make("1"), make("2", true), make("3")])).toBe(2);
  });

  it("replaces just the alert that was marked read, keeping order", () => {
    const list = [make("3"), make("2"), make("1")];
    const next = applyRead(list, make("2", true));
    expect(next.map((a) => a.id)).toEqual(["3", "2", "1"]);
    expect(next.map((a) => a.read)).toEqual([false, true, false]);
    expect(list[1].read).toBe(false);
  });
});

describe("runMarkRead", () => {
  it("returns the read alert and tells the top bar to re-read its count", async () => {
    const notify = vi.fn();
    const markAlertRead = vi.fn(async () => ({ ok: true as const, alert: make("2", true) }));
    const out = await runMarkRead("2", { markAlertRead, notify });
    expect(markAlertRead).toHaveBeenCalledWith("2");
    expect(out).toEqual({ ok: true, alert: make("2", true), message: MARKED_READ });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("reports a failure and leaves the count alone", async () => {
    const notify = vi.fn();
    const out = await runMarkRead("2", { markAlertRead: async () => ({ ok: false }), notify });
    expect(out).toEqual({ ok: false, message: MARK_FAILED });
    expect(MARK_FAILED).toBe("Couldn't mark this alert as read. Try again.");
    expect(notify).not.toHaveBeenCalled();
  });

  it("names the change event the top bar listens for", () => {
    expect(ALERTS_CHANGED_EVENT).toBe("alerts:changed");
  });
});

describe("AlertsScreen", () => {
  const html = renderToStaticMarkup(
    <AlertsScreen initialAlerts={[make("3"), make("2", true), make("1")]} />,
  );

  it("lists the alerts in the order given, newest first", () => {
    expect(html.indexOf("Sender 3")).toBeLessThan(html.indexOf("Sender 2"));
    expect(html.indexOf("Sender 2")).toBeLessThan(html.indexOf("Sender 1"));
  });

  it("shows the unread count beside the title", () => {
    expect(html).toContain("<h1>Alerts</h1>");
    expect(html).toContain("2 unread");
    expect(html).toContain("badge-danger");
  });

  it("announces list changes politely", () => {
    expect(html).toContain('aria-live="polite"');
  });

  it("shows the empty message and no count when there are no alerts", () => {
    const empty = renderToStaticMarkup(<AlertsScreen initialAlerts={[]} />);
    expect(empty).toContain("No alerts yet");
    expect(empty).not.toContain("unread");
  });

  it("shows no count when everything is read", () => {
    const allRead = renderToStaticMarkup(<AlertsScreen initialAlerts={[make("1", true)]} />);
    expect(allRead).not.toContain("badge-danger");
  });
});
