import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { formatMoney, removeLine, type Cart } from "@/lib/cart";
import { CartButton } from "./CartButton";
import { CartDrawer } from "./CartDrawer";
import { cartDrawerReducer, handleCheckout } from "./MenuCart";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const cart: Cart = [
  { id: "m", name: "Margherita", unitPrice: 10, quantity: 2, image: "/menu/margherita.svg" },
  { id: "c", name: "Cola", unitPrice: 3, quantity: 1, image: "/menu/cola.svg" },
];
const noop = {
  onClose: () => {},
  onIncrease: () => {},
  onDecrease: () => {},
  onRemove: () => {},
  onCheckout: () => {},
};
const drawer = (c: Cart, signedIn = false, open = true) =>
  renderToStaticMarkup(<CartDrawer open={open} cart={c} signedIn={signedIn} {...noop} />);

describe("CartDrawer", () => {
  it("shows a dialog over the Menu when open, nothing when closed (AC1, AC10)", () => {
    const html = drawer(cart);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Your cart"');
    expect(html).toContain("data-backdrop");
    expect(html).toContain('aria-label="Close cart"');
    expect(drawer(cart, false, false)).toBe("");
  });

  it("shows each line's name, quantity and image (AC2)", () => {
    const html = drawer(cart);
    expect(html).toMatch(/Margherita/);
    expect(html).toMatch(/Cola/);
    expect(html).toContain('aria-label="Quantity 2"');
    expect(html).toContain('aria-label="Quantity 1"');
    expect(html).toContain('src="/menu/margherita.svg"');
  });

  it("shows the total (AC5)", () => {
    expect(drawer([{ ...cart[0], quantity: 3 }])).toContain(formatMoney(30));
  });

  it("drops a removed line and its amount (AC6)", () => {
    const html = drawer(removeLine(cart, "m"));
    expect(html).not.toContain("Margherita");
    expect(html).toContain(formatMoney(3));
  });

  it("shows the empty message only without lines (AC8, AC9)", () => {
    const empty = drawer([]);
    expect(empty).toContain("Your cart is empty");
    expect(empty).toContain('class="empty-state"');
    expect(drawer(cart)).not.toContain("Your cart is empty");
  });

  it("shows an enabled Checkout with lines (AC11)", () => {
    const html = drawer(cart);
    expect(html).toMatch(/<button[^>]*class="btn btn-primary btn-lg"[^>]*>Checkout</);
    expect(html).not.toMatch(/class="btn btn-primary btn-lg"[^>]*disabled/);
  });

  it("shows Checkout disabled when empty (AC15)", () => {
    expect(drawer([])).toMatch(/<button[^>]*disabled=""[^>]*>Checkout</);
  });

  it("shows the guest note only to guests with lines (AC13)", () => {
    expect(drawer(cart, false)).toContain("sign in at Checkout");
    expect(drawer(cart, true)).not.toContain("sign in at Checkout");
    expect(drawer([], false)).not.toContain("sign in at Checkout");
  });
});

describe("CartButton", () => {
  it("opens the cart and shows the count (AC1)", () => {
    const html = renderToStaticMarkup(<CartButton count={3} onClick={() => {}} />);
    expect(html).toContain('aria-label="Open cart"');
    expect(html).toContain(">3<");
  });
});

describe("MenuCart wiring", () => {
  it("toggles the drawer (AC1, AC10)", () => {
    expect(cartDrawerReducer(false, "open")).toBe(true);
    expect(cartDrawerReducer(true, "close")).toBe(false);
  });

  it("closes and goes to checkout (AC12)", () => {
    const push = vi.fn();
    const close = vi.fn();
    handleCheckout({ push, close });
    expect(push).toHaveBeenCalledWith("/checkout");
    expect(close).toHaveBeenCalled();
  });
});
