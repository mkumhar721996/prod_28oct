"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addItem, decrease, increase, removeLine, type Cart, type CartLine } from "@/lib/cart";
import { CART_STORAGE_KEY, parseCart, serializeCart } from "@/lib/cartStorage";

type Removed = { line: CartLine; index: number };

type CartContextValue = {
  cart: Cart;
  /** The line last removed with the Remove button, offered back through Undo. */
  removed: CartLine | null;
  add: (item: Omit<CartLine, "quantity">) => void;
  increase: (id: string) => void;
  decrease: (id: string) => void;
  remove: (id: string) => void;
  undoRemove: () => void;
  dismissRemoved: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Browser-side cart kept in localStorage, so it survives refresh and the trip through sign-in. */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>([]);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const cartRef = useRef(cart);
  cartRef.current = cart;

  // localStorage is only readable after mount, so the first render is always empty.
  useEffect(() => {
    try {
      const stored = parseCart(window.localStorage.getItem(CART_STORAGE_KEY));
      // Edits made before hydration win over what was stored.
      setCart((c) => (c.length === 0 ? stored : [...stored.filter((s) => !c.some((l) => l.id === s.id)), ...c]));
    } catch {
      // Storage blocked: carry on with an in-memory cart.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(cart));
    } catch {
      // Storage full or blocked: the cart still works for this page view.
    }
  }, [cart, hydrated]);

  const add = useCallback((item: Omit<CartLine, "quantity">) => setCart((c) => addItem(c, item)), []);
  const inc = useCallback((id: string) => setCart((c) => increase(c, id)), []);
  const dec = useCallback((id: string) => setCart((c) => decrease(c, id)), []);
  const remove = useCallback((id: string) => {
    // Read the latest cart, not a render-time closure, so a quick second edit can't record a stale line.
    const latest = cartRef.current;
    const index = latest.findIndex((l) => l.id === id);
    if (index < 0) return;
    setRemoved({ line: latest[index], index });
    cartRef.current = removeLine(latest, id);
    setCart(cartRef.current);
  }, []);
  const undoRemove = useCallback(() => {
    if (!removed) return;
    setCart((c) =>
      c.some((l) => l.id === removed.line.id)
        ? c
        : [...c.slice(0, removed.index), removed.line, ...c.slice(removed.index)],
    );
    setRemoved(null);
  }, [removed]);
  const dismissRemoved = useCallback(() => setRemoved(null), []);

  const value = useMemo(
    () => ({
      cart,
      removed: removed?.line ?? null,
      add,
      increase: inc,
      decrease: dec,
      remove,
      undoRemove,
      dismissRemoved,
    }),
    [cart, removed, add, inc, dec, remove, undoRemove, dismissRemoved],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
