import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Order, OrderStatus } from "@/lib/orders";
import { OrderRow } from "./OrderRow";

const order: Order = {
  id: "o1",
  number: "1048",
  title: "Lunch for two",
  status: "Preparing",
  placedAt: "2026-10-28T12:40:00Z",
};
const render = (o: Order) => renderToStaticMarkup(<ul><OrderRow order={o} /></ul>);

describe("OrderRow", () => {
  it("shows title, order number and status", () => {
    const html = render(order);
    expect(html).toContain("Lunch for two");
    expect(html).toContain("Order #1048");
    expect(html).toContain("Preparing");
  });

  it("pairs every status word with an icon", () => {
    const statuses: OrderStatus[] = ["Received", "Preparing", "Ready for pickup", "Fulfilled", "Cancelled"];
    for (const status of statuses) {
      const html = render({ ...order, status });
      expect(html).toContain(`${status}</span>`);
      expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    }
  });

  it("is not interactive", () => {
    const html = render(order);
    expect(html).not.toMatch(/<(a|button)\b/);
    expect(html).not.toContain("onClick");
    expect(html).not.toContain("href=");
  });
});
