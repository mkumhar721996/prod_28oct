"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";
import { TopBar } from "./TopBar";

export const SIGN_OUT_ERROR = "Sign out failed. You are still signed in. Try again.";

type SignOutDeps = {
  signOut: () => Promise<void>;
  replace: (href: string) => void;
  refresh: () => void;
};

/** On failure only the error is set: no navigation, so the user stays signed in with the button. */
export async function handleSignOut(
  deps: SignOutDeps,
  setError: (message: string | null) => void,
): Promise<void> {
  setError(null);
  try {
    await deps.signOut();
  } catch {
    setError(SIGN_OUT_ERROR);
    return;
  }
  deps.replace(SIGN_IN_HREF);
  deps.refresh();
}

/** Client wrapper: owns the pathname, Menu, account menu and sign-out state for the shared top bar. */
export function TopBarControls({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Escape or a click outside closes the account menu and returns focus to its button.
  useEffect(() => {
    if (!accountOpen) return;
    const close = (refocus: boolean) => {
      setAccountOpen(false);
      if (refocus) document.getElementById("account-button")?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".account")) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [accountOpen]);

  async function onSignOut() {
    setSigningOut(true);
    await handleSignOut({ signOut, replace: router.replace, refresh: router.refresh }, setError);
    setSigningOut(false);
  }

  return (
    <TopBar
      signedIn={signedIn}
      pathname={pathname}
      menuOpen={menuOpen}
      accountOpen={accountOpen}
      error={error}
      onToggleMenu={() => setMenuOpen((open) => !open)}
      onToggleAccount={() => setAccountOpen((open) => !open)}
      onSignOut={onSignOut}
      signingOut={signingOut}
    />
  );
}
