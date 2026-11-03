"use client";

import { useEffect, useRef } from "react";
import { cartTotal, formatMoney, type Cart } from "@/lib/cart";
import { Icon } from "../orders/Icon";
import { CartLine } from "./CartLine";

type CartDrawerProps = {
  open: boolean;
  cart: Cart;
  signedIn: boolean;
  onClose: () => void;
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
};

const FOCUSABLE = "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

export function CartDrawer({
  open,
  cart,
  signedIn,
  onClose,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
}: CartDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      // Keep Tab inside the drawer while it is open.
      const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="backdrop is-open" data-backdrop="cart-drawer" onClick={onClose} />
      <aside
        ref={drawerRef}
        className="drawer is-open"
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
      >
        <div className="drawer-header">
          <h2>Your cart</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Close cart"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="drawer-body">
          {cart.length === 0 ? (
            <div className="empty-state">
              <Icon name="bag" />
              <h3>Your cart is empty</h3>
              <p>Add a dish from the menu and it will show up here.</p>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Back to menu
              </button>
            </div>
          ) : (
            <>
              <ul className="cart-lines" aria-label="Items in your cart">
                {cart.map((line) => (
                  <CartLine
                    key={line.id}
                    line={line}
                    onIncrease={onIncrease}
                    onDecrease={onDecrease}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
              {!signedIn && (
                <div className="alert alert-info cart-guest-note">
                  <Icon name="info" />
                  <span>Not signed in? You&apos;ll sign in at Checkout and your cart stays as it is.</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="drawer-footer">
          <div className="cart-total-row">
            <span>Total</span>
            <span aria-live="polite">{formatMoney(cartTotal(cart))}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={cart.length === 0}
            onClick={onCheckout}
          >
            Checkout
          </button>
        </div>
      </aside>
    </>
  );
}
