import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatMoney, type Cart } from "@/lib/cart";
import { OrderSummary } from "./OrderSummary";

const cart: Cart = [
  { id: "p1", name: "Pizza", unitPrice: 900, quantity: 2, image: "/p1.jpg" },
  { id: "p2", name: "Cola", unitPrice: 90, quantity: 1, image: "/p2.jpg" },
];

describe("OrderSummary (AC10)", () => {
  const html = renderToStaticMarkup(<OrderSummary cart={cart} />);

  it("is a labelled list with one item per line", () => {
    expect(html).toContain('aria-label="Order summary"');
    expect(html.match(/<li /g)).toHaveLength(2);
  });

  it("shows each line's name, quantity × price and line total", () => {
    expect(html).toContain("Pizza");
    expect(html).toContain(`2 × ${formatMoney(900)}`);
    expect(html).toContain(formatMoney(1800));
  });

  it("shows the total and no editing controls", () => {
    expect(html).toContain(formatMoney(1890));
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<img");
  });
});
