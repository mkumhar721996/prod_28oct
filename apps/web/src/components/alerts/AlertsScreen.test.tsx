import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialAlertsState, type Alert, type AlertsState } from "@/lib/alerts";
import { AlertsScreen } from "./AlertsScreen";

const alert = (id: string, amountMinor: number, read = false): Alert => ({
  id,
  kind: "money_received",
  amountMinor,
  currency: "USD",
  senderName: "Sam Okafor",
  read,
  createdAt: "2026-11-02T09:00:00.000Z",
});
const render = (state: Partial<AlertsState>) =>
  renderToStaticMarkup(<AlertsScreen initial={{ ...initialAlertsState, ...state }} />);

describe("AlertsScreen", () => {
  it("lists every alert, newest first as the API returned them", () => {
    const html = render({ alerts: [alert("c", 30000), alert("b", 20000), alert("a", 10000)] });
    expect(html.match(/Money received/g)).toHaveLength(3);
    const order = ["$300.00", "$200.00", "$100.00"].map((a) => html.indexOf(a));
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(order[0]).toBeGreaterThan(-1);
  });

  it("shows the unread count in the title row", () => {
    const html = render({ alerts: [alert("a", 100), alert("b", 200), alert("c", 300, true)] });
    expect(html).toMatch(/role="status"[^>]*>.*badge-danger[^>]*>2 unread/);
  });

  it("hides the unread badge at 0", () => {
    const html = render({ alerts: [alert("a", 100, true)] });
    expect(html).not.toContain("unread");
    expect(html).not.toContain("badge-danger");
  });

  it("shows a message when there are no alerts", () => {
    const html = render({ alerts: [] });
    expect(html).toContain("No alerts yet");
    expect(html).not.toContain("unread");
  });

  it("shows skeletons while loading", () => {
    const html = render({});
    expect(html.match(/class="skeleton /g)).toHaveLength(2);
  });

  it("shows a retryable error when the list cannot load", () => {
    const html = render({ loadFailed: true });
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t load your alerts. Check your connection and try again.");
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
  });

  it("shows a card as marking while pending", () => {
    const html = render({ alerts: [alert("a", 100)], pending: ["a"] });
    expect(html).toContain("Marking as read…");
  });
});
