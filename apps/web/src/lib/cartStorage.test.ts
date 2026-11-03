import { describe, expect, it } from "vitest";
import { parseCart, serializeCart } from "./cartStorage";
import { signInTarget } from "./shell";

const line = { id: "m", name: "Margherita", unitPrice: 10, quantity: 2, image: "/menu/margherita.svg" };

describe("cart storage (AC13)", () => {
  it("round-trips a cart with all five fields", () => {
    expect(parseCart(serializeCart([line]))).toEqual([line]);
    expect(parseCart(serializeCart([line]))[0]).toEqual(line);
  });

  it("returns an empty cart for null, bad JSON and bad shapes", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart('[{"itemId":1}]')).toEqual([]);
    expect(parseCart('{"a":1}')).toEqual([]);
  });

  it("rejects a line missing a field", () => {
    const { image: _image, ...noImage } = line;
    expect(parseCart(JSON.stringify([noImage]))).toEqual([]);
  });

  it("returns to checkout after sign-in", () => {
    expect(signInTarget("checkout")).toBe("/checkout");
  });
});
