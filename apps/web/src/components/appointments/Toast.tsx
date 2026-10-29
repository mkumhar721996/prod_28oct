"use client";

import { useEffect } from "react";
import { Icon } from "../orders/Icon";

export const TOAST_MS = 4000;

/** A transient confirmation; asks to be hidden after TOAST_MS. */
export function Toast({ message, onHide }: { message: string; onHide?: () => void }) {
  useEffect(() => {
    if (!onHide) return;
    const timer = setTimeout(onHide, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onHide]);

  return (
    <div className="toast is-open" role="status">
      <Icon name="check" />
      <span>{message}</span>
    </div>
  );
}
