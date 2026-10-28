import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NoOrders } from "./NoOrders";

describe("NoOrders", () => {
  const html = renderToStaticMarkup(<NoOrders />);

  it("explains there are no orders", () => {
    expect(html).toContain("You have no orders yet");
    expect(html).toContain('class="empty-state"');
    expect(html).not.toContain("order-list");
  });

  it("offers one primary action to the Menu", () => {
    expect(html).toMatch(/<a[^>]*class="btn btn-primary"[^>]*href="\/menu"[^>]*>Browse the menu</);
    expect(html.match(/btn-primary/g)).toHaveLength(1);
  });
});
