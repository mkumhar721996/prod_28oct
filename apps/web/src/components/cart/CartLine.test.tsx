import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartLine } from "./CartLine";

const line = { id: "m", name: "Margherita", unitPrice: 1299, quantity: 2, image: "/menu/margherita.svg" };

describe("CartLine", () => {
  const html = renderToStaticMarkup(
    <CartLine line={line} onIncrease={() => {}} onDecrease={() => {}} onRemove={() => {}} />,
  );

  it("shows name, each price, subtotal and quantity", () => {
    expect(html).toContain("Margherita");
    expect(html).toContain("₹1,299 each");
    expect(html).toContain("₹2,598");
    expect(html).toContain('aria-label="Quantity 2"');
  });

  it("shows the image with empty alt and a Remove button", () => {
    expect(html).toContain('src="/menu/margherita.svg"');
    expect(html).toContain('alt=""');
    expect(html).toMatch(/<button[^>]*>Remove</);
  });
});
