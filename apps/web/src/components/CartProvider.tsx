"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { CART_STORAGE_KEY, cartCount, cartReducer, parseStoredCart, type CartLine } from "@/lib/cart";

type CartContextValue = { lines: CartLine[]; count: number; add: (itemId: string) => void };

const CartContext = createContext<CartContextValue>({ lines: [], count: 0, add: () => {} });

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, []);
  const restored = useRef(false);

  // Read after mount so server and first client render match.
  useEffect(() => {
    try {
      const stored = parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
      if (stored.length > 0) dispatch({ type: "restore", lines: stored });
    } catch {
      // storage unavailable: start empty
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // storage unavailable: the cart lives in memory only
    }
  }, [lines]);

  const add = useCallback((itemId: string) => dispatch({ type: "add", itemId }), []);
  const value = useMemo(() => ({ lines, count: cartCount(lines), add }), [lines, add]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  return useContext(CartContext);
}
