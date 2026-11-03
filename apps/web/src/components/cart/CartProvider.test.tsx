import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartProvider, useCart } from "./CartProvider";

function Probe() {
  const { clear, hydrated, cart } = useCart();
  return (
    <p>
      {typeof clear} {String(hydrated)} {cart.length}
    </p>
  );
}

describe("CartProvider", () => {
  it("exposes clear, and is not hydrated until storage has been read in the browser", () => {
    expect(renderToStaticMarkup(<CartProvider><Probe /></CartProvider>)).toBe("<p>function false 0</p>");
  });
});
