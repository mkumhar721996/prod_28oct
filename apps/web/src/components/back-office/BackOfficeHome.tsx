"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { IDENTITY_VERIFICATIONS_HREF, STAFF_SIGN_IN_HREF } from "@/lib/shell";
import { signOutStaff } from "@/lib/staffSession";
import { Toast } from "../appointments/Toast";
import { Icon } from "../orders/Icon";

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
      <h1>Back-office tools</h1>
      <div className="card">
        <div className="empty-state">
          <Link className="btn btn-primary" href={IDENTITY_VERIFICATIONS_HREF}>
            Review identity verifications
          </Link>
          <span className="badge badge-info">Signed in as staff</span>
        </div>
      </div>
      {toast && <Toast message={toast} onHide={hideToast} />}
    </div>
  );
}
