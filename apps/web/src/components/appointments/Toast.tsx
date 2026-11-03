"use client";

import { useEffect } from "react";
import { Icon } from "../orders/Icon";

export const TOAST_MS = 4000;

type ToastAction = { label: string; onAction: () => void };

/** A transient confirmation; asks to be hidden after TOAST_MS. An optional action (e.g. Undo) sits beside it. */
export function Toast({
  message,
  onHide,
  action,
  inline,
  tone = "success",
}: {
  message: string;
  onHide?: () => void;
  action?: ToastAction;
  inline?: boolean;
  tone?: "success" | "error";
}) {
  useEffect(() => {
    if (!onHide) return;
    const timer = setTimeout(onHide, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onHide]);

  return (
    <div
      className={`toast is-open${inline ? " is-inline" : ""}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={tone === "error" ? "alert" : "check"} />
      <span>{message}</span>
      {action && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={action.onAction}>
          {action.label}
        </button>
      )}
    </div>
  );
}
