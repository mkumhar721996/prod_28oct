"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { STAFF_SIGN_IN_HREF } from "@/lib/shell";
import { signOutStaff } from "@/lib/staffSession";
import { Toast } from "../appointments/Toast";
import { Icon } from "../orders/Icon";
import { AccountsScreen } from "./AccountsScreen";

type SignOutDeps = { signOutStaff: () => Promise<void>; replace: (href: string) => void };

/** Ends the staff session, then goes to the staff sign-in. Returns false (and stays put) if sign-out failed. */
export async function handleStaffSignOut(deps: SignOutDeps): Promise<boolean> {
  try {
    await deps.signOutStaff();
  } catch {
    return false;
  }
  deps.replace(STAFF_SIGN_IN_HREF);
  return true;
}

export function BackOfficeHome() {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  async function onSignOut() {
    const ok = await handleStaffSignOut({ signOutStaff, replace: router.replace });
    setToast(ok ? "You are signed out" : "Sign out failed. Try again.");
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <button className="btn btn-ghost" type="button" onClick={onSignOut}>
          <Icon name="user" /> Sign out
        </button>
      </div>
      <AccountsScreen />
      <div className="card">
        <div className="empty-state">
          <h2>Back-office tools</h2>
          <p>Review identity verifications will appear here.</p>
          <span className="badge badge-info">Signed in as staff</span>
        </div>
      </div>
      {toast && <Toast message={toast} onHide={hideToast} />}
    </div>
  );
}
