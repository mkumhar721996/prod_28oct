"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "@/lib/session";
import { SIGN_IN_HREF, runSignOut } from "@/lib/shell";

/** Brand, Menu toggle, the collapsible nav (children) and Sign out for the signed-in header. */
export function TopBarControls({ brand, children }: { brand: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setFailed(false);
    const ok = await runSignOut(signOut, () => {
      router.replace(SIGN_IN_HREF);
      router.refresh();
    });
    setFailed(!ok);
    setPending(false);
  }

  return (
    <>
      <div className="shell-group">
        {brand}
        <button
          className="btn btn-secondary btn-sm shell-menu-btn"
          type="button"
          aria-controls="main-nav"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        {children}
      </div>
      <button
        className="btn btn-ghost btn-sm shell-signout"
        type="button"
        onClick={handleSignOut}
        disabled={pending}
      >
        Sign out
      </button>
      {failed && (
        <div className="alert alert-danger shell-error" role="alert">
          <span aria-hidden="true">!</span>
          <span>Sign out failed. You are still signed in. Try again.</span>
        </div>
      )}
    </>
  );
}
