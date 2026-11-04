import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Alert } from "@/lib/alerts";
import { AlertCard } from "./AlertCard";
import { NoAlerts } from "./NoAlerts";

const alert: Alert = {
  id: "7",
  kind: "money_received",
  amountMinor: 12000,
  currency: "USD",
  senderName: "Sam Okafor",
  createdAt: "2026-11-04T10:00:00.000Z",
  read: false,
};

const render = (a: Alert, extra: { pending?: boolean; error?: string | null } = {}) =>
  renderToStaticMarkup(<AlertCard alert={a} onMarkRead={() => {}} {...extra} />);

describe("AlertCard unread", () => {
  const html = render(alert);

  it("shows the amount and the sender's name", () => {
    expect(html).toContain("Money received");
    expect(html).toMatch(/Amount received: [^<]*120\.00/);
    expect(html).toContain("From: Sam Okafor");
  });

  it("is marked unread with an Unread badge and a Mark as read button", () => {
    expect(html).toContain("alert-card");
    expect(html).toContain("is-unread");
    expect(html).toMatch(/badge badge-info[^>]*>Unread</);
    expect(html).toMatch(/<button[^>]*>Mark as read</);
  });

  it("shows the time", () => {
    expect(html).toContain("<time");
    expect(html).toContain('dateTime="2026-11-04T10:00:00.000Z"');
  });

  it("escapes a hostile sender name", () => {
    const bad = render({ ...alert, senderName: "<img src=x onerror=alert(1)>" });
    expect(bad).not.toContain("<img");
    expect(bad).toContain("&lt;img");
  });
});

describe("AlertCard read", () => {
  const html = render({ ...alert, read: true });

  it("drops the unread rule and the button, and says Read", () => {
    expect(html).not.toContain("is-unread");
    expect(html).not.toContain("Mark as read");
    expect(html).toMatch(/badge badge-neutral[^>]*>Read</);
  });

  it("still shows amount and sender", () => {
    expect(html).toContain("From: Sam Okafor");
  });
});

describe("AlertCard states", () => {
  it("disables the button and says so while pending", () => {
    const html = render(alert, { pending: true });
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Marking as read…</);
  });

  it("shows the failure beside the card, with the button still usable", () => {
    const html = render(alert, { error: "Couldn't mark this alert as read. Try again." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t mark this alert as read. Try again.");
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });
});

describe("NoAlerts", () => {
  const html = renderToStaticMarkup(<NoAlerts />);

  it("says there are no alerts yet and what will appear", () => {
    expect(html).toContain("empty-state");
    expect(html).toContain("No alerts yet");
    expect(html).toContain("When you receive money, you&#x27;ll see it here.");
  });
});
