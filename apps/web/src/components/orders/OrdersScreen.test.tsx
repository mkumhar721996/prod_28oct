import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Order, TabState } from "@/lib/orders";
import { OrdersScreen } from "./OrdersScreen";

const lunch: Order = {
  id: "o1",
  number: "1048",
  title: "Lunch for two",
  status: "Preparing",
  placedAt: "2026-10-28T12:40:00Z",
};
const loaded = (status: TabState["status"]): TabState => ({
  items: [lunch],
  nextCursor: "c1",
  status,
});
const render = (initial: React.ComponentProps<typeof OrdersScreen>["initial"]) =>
  renderToStaticMarkup(<OrdersScreen initial={initial} />);

describe("OrdersScreen", () => {
  it("shows Active and Past tabs, Active selected", () => {
    const html = render({ active: loaded("idle") });
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Active</);
    expect(html).toMatch(/role="tab"[^>]*aria-selected="false"[^>]*>Past</);
  });

  it("lists the loaded orders", () => {
    const html = render({ active: loaded("idle") });
    expect(html).toContain("Lunch for two");
    expect(html).toContain('aria-label="Active orders"');
  });

  it("shows skeleton rows while the first page loads", () => {
    const html = render({ active: { items: [], nextCursor: null, status: "loading-first" } });
    expect(html).toContain('aria-label="Loading your orders"');
    expect(html).not.toContain("order-list");
  });

  it("shows a loading indicator while a later page loads", () => {
    const html = render({ active: loaded("loading-more") });
    expect(html).toContain("Loading more orders");
    expect(html).toContain('role="status"');
    expect(html).toContain("Lunch for two");
  });

  it("shows an inline error with Retry and keeps loaded rows when a later page fails", () => {
    const html = render({ active: loaded("error-more") });
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t load more orders");
    expect(html).toContain(">Retry<");
    expect(html).toContain("Lunch for two");
  });

  it("shows an error with Retry when the first page fails", () => {
    const html = render({ active: { items: [], nextCursor: null, status: "error-first" } });
    expect(html).toContain('role="alert"');
    expect(html).toContain(">Retry<");
  });

  it("shows the No orders screen when the customer has no orders", () => {
    const html = render({
      active: { items: [], nextCursor: null, status: "idle" },
      hasAnyOrders: false,
    });
    expect(html).toContain("You have no orders yet");
    expect(html).toContain('class="empty-state"');
    expect(html).not.toContain("order-list");
    expect(html).toContain("Browse the menu");
  });

  it("explains an empty tab when the other tab has orders", () => {
    const html = render({ active: { items: [], nextCursor: null, status: "idle" } });
    expect(html).toContain("You have no active orders right now");
  });
});
