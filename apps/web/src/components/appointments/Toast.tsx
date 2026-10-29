"use client";

import { useEffect } from "react";
import { Icon, type IconName } from "../orders/Icon";

export const TOAST_MS = 4000;

type Props = {
  message: string;
  onHide?: () => void;
  icon?: IconName;
  role?: "status" | "alert";
};

/** A transient message; asks to be hidden after TOAST_MS. */
export function Toast({ message, onHide, icon = "check", role = "status" }: Props) {
  useEffect(() => {
    if (!onHide) return;
    const timer = setTimeout(onHide, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onHide]);

  return (
    <div className="toast is-open" role={role}>
      <Icon name={icon} />
      <span>{message}</span>
    </div>
  );
}
