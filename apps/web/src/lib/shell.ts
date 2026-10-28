/** The one place the brand text lives; change it here and the header (and page title) follow. */
export const BRAND_NAME = "Web App";
export const HOME_HREF = "/";
export const SIGN_IN_HREF = "/sign-in";

export type NavEntry = { key: string; label: string; href: string };

/** Append new sections to the end so existing positions stay stable. */
export const MAIN_NAV: readonly NavEntry[] = [{ key: "home", label: "Home", href: HOME_HREF }];

export function brandHref(signedIn: boolean): string {
  return signedIn ? HOME_HREF : SIGN_IN_HREF;
}

export function visibleNav(signedIn: boolean): readonly NavEntry[] {
  return signedIn ? MAIN_NAV : [];
}

export function isCurrent(entry: NavEntry, pathname: string): boolean {
  return entry.href === pathname;
}

/** Runs sign out; calls onSuccess only when it resolves. Returns whether it succeeded. */
export async function runSignOut(
  signOut: () => Promise<void>,
  onSuccess: () => void,
): Promise<boolean> {
  try {
    await signOut();
  } catch {
    return false;
  }
  onSuccess();
  return true;
}
