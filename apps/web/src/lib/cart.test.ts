import { describe, expect, it } from "vitest";
import {
  addItem,
  cartCount,
  cartTotal,
  decrease,
  formatMoney,
  increase,
  removeLine,
  setQuantity,
} from "./cart";

const image = "/menu/margherita.svg";
const m = { id: "m", name: "Margherita", unitPrice: 10, quantity: 2, image };
const cola = { id: "c", name: "Cola", unitPrice: 3, quantity: 1, image: "/menu/cola.svg" };

describe("cart model", () => {
  it("adds a line at 1 or increments an existing one (AC3)", () => {
    expect(addItem([], { id: "m", name: "Margherita", unitPrice: 10, image })[0].quantity).toBe(1);
    expect(addItem([m], m)[0].quantity).toBe(3);
  });

  it("increases a quantity from 2 to 3 (AC3)", () => {
    expect(increase([m], "m")[0].quantity).toBe(3);
  });

  it("decreases a quantity from 2 to 1 (AC4)", () => {
    expect(decrease([m], "m")[0].quantity).toBe(1);
  });

  it("derives the total from the lines (AC5)", () => {
    expect(cartTotal([m])).toBe(20);
    expect(cartTotal(increase([m], "m"))).toBe(30);
  });

  it("removes a line and its amount (AC6, AC7)", () => {
    const cart = [m, cola];
    expect(cartTotal(cart)).toBe(23);
    expect(removeLine(cart, "m").map((l) => l.name)).toEqual(["Cola"]);
    expect(cartTotal(removeLine(cart, "m"))).toBe(3);
  });

  it("removes a line when the quantity drops below 1 (AC14)", () => {
    const one = [{ ...m, quantity: 1 }];
    expect(decrease(one, "m")).toEqual([]);
    expect(setQuantity(one, "m", 0)).toEqual([]);
  });

  it("counts units for the badge", () => {
    expect(cartCount([m, cola])).toBe(3);
  });

  it("does not mutate the input", () => {
    const cart = [m];
    increase(cart, "m");
    expect(cart[0].quantity).toBe(2);
  });
});

describe("formatMoney", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatMoney(299)).toBe("₹299");
    expect(formatMoney(1299)).toBe("₹1,299");
    expect(formatMoney(125000)).toBe("₹1,25,000");
    expect(formatMoney(299)).not.toContain("$");
  });
});
