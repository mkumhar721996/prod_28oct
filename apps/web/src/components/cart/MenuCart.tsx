"use client";

import { useRouter } from "next/navigation";
import { useCallback, useReducer, useRef } from "react";
import { cartCount } from "@/lib/cart";
import { CHECKOUT_HREF } from "@/lib/shell";
import { Toast } from "../appointments/Toast";
import { CartButton } from "./CartButton";
import { CartDrawer } from "./CartDrawer";
import { useCart } from "./CartProvider";

export function cartDrawerReducer(_open: boolean, action: "open" | "close"): boolean {
  return action === "open";
}

type CheckoutDeps = { push: (href: string) => void; close: () => void };

export function handleCheckout({ push, close }: CheckoutDeps): void {
  close();
  push(CHECKOUT_HREF);
}

/** The Menu's Cart button and the drawer it opens. */
export function MenuCart({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const cart = useCart();
  const [open, dispatch] = useReducer(cartDrawerReducer, false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    dispatch("close");
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <CartButton ref={buttonRef} count={cartCount(cart.cart)} onClick={() => dispatch("open")} />
      <CartDrawer
        open={open}
        cart={cart.cart}
        signedIn={signedIn}
        onClose={close}
        onIncrease={cart.increase}
        onDecrease={cart.decrease}
        onRemove={cart.remove}
        onCheckout={() => handleCheckout({ push: router.push, close: () => dispatch("close") })}
      />
      {cart.removed && (
        <Toast
          message={`${cart.removed.name} removed`}
          action={{ label: "Undo", onAction: cart.undoRemove }}
          onHide={cart.dismissRemoved}
        />
      )}
    </>
  );
}
