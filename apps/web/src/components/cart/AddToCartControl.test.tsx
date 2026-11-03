import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddToCartControl } from "./AddToCartControl";

const item = { id: "m", name: "Margherita", unitPrice: 10, image: "/menu/margherita.svg" };
const noop = { onAdd: () => {}, onIncrease: () => {}, onDecrease: () => {} };

describe("AddToCartControl", () => {
  it("offers Add to cart when the item is not in the cart", () => {
    const html = renderToStaticMarkup(<AddToCartControl item={item} cart={[]} {...noop} />);
    expect(html).toContain("Add to cart");
    expect(html).not.toContain("stepper");
  });

  it("shows the stepper once the item is in the cart", () => {
    const html = renderToStaticMarkup(
      <AddToCartControl item={item} cart={[{ ...item, quantity: 1 }]} {...noop} />,
    );
    expect(html).toContain("stepper");
    expect(html).toContain('aria-label="Remove Margherita"');
    expect(html).not.toContain("Add to cart");
  });
});
