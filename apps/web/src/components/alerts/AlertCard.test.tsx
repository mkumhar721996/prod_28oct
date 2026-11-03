import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Alert } from "@/lib/alerts";
import { AlertCard } from "./AlertCard";

const alert: Alert = {
  id: "a1",
  kind: "money_received",
  amountMinor: 12000,
  currency: "USD",
  senderName: "Sam Okafor",
  read: false,
  createdAt: "2026-11-02T09:00:00.000Z",
};
const render = (props: Partial<React.ComponentProps<typeof AlertCard>> = {}) =>
  renderToStaticMarkup(<AlertCard alert={alert} {...props} />);

describe("AlertCard", () => {
  it("shows the amount received", () => {
    expect(render()).toContain("Amount received: $120.00");
  });

  it("shows the sender's name as text only", () => {
    expect(render()).toContain("From: Sam Okafor");
    const html = render({ alert: { ...alert, senderName: "<b>x</b>" } });
    expect(html).toContain("From: &lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });

  it("is unread with a Mark as read button", () => {
    const html = render();
    expect(html).toContain("Money received");
    expect(html).toContain("is-unread");
    expect(html).toContain("badge-info");
    expect(html).toMatch(/<button[^>]*>Mark as read<\/button>/);
  });

  it("is read without the button", () => {
    const html = render({ alert: { ...alert, read: true } });
    expect(html).toContain(">Read<");
    expect(html).not.toContain("Mark as read");
    expect(html).not.toContain("is-unread");
  });

  it("disables the button while marking", () => {
    expect(render({ pending: true })).toMatch(/<button[^>]*disabled[^>]*>Marking as read…<\/button>/);
  });

  it("stays unread and explains when marking failed", () => {
    const html = render({ failed: true });
    expect(html).toContain("We couldn&#x27;t mark that alert as read. Try again.");
    expect(html).toContain("Mark as read");
  });
});
