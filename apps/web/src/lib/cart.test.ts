import { describe, expect, it } from "vitest";
import { cartCount, cartReducer, parseStoredCart } from "./cart";

describe("cart", () => {
  it("counts 0 for an empty cart and 1 after the first add", () => {
    expect(cartCount([])).toBe(0);
    const lines = cartReducer([], { type: "add", itemId: "d1" });
    expect(cartCount(lines)).toBe(1);
  });

  it("increments the quantity of an existing line", () => {
    const lines = cartReducer([{ itemId: "d1", quantity: 1 }], { type: "add", itemId: "d1" });
    expect(lines).toEqual([{ itemId: "d1", quantity: 2 }]);
    expect(cartCount(cartReducer(lines, { type: "add", itemId: "d2" }))).toBe(3);
  });

  it("restores stored lines and treats corrupt storage as empty", () => {
    expect(parseStoredCart(JSON.stringify([{ itemId: "d1", quantity: 2 }]))).toEqual([
      { itemId: "d1", quantity: 2 },
    ]);
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart("{not json")).toEqual([]);
    expect(parseStoredCart(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(parseStoredCart(JSON.stringify([{ itemId: 1, quantity: "x" }]))).toEqual([]);
  });
});
