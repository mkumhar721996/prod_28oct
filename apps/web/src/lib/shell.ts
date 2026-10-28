/** The one place the brand text lives; change it here and the header (and page title) follow. */
export const BRAND_NAME = "Web App";
export const HOME_HREF = "/";
export const SIGN_IN_HREF = "/sign-in";

/** `roles` omitted means every signed-in user; otherwise only the listed roles. */
export type NavEntry = { key: string; label: string; href: string; roles?: readonly string[] };

/** Append new sections to the end so existing positions stay stable. */
export const MAIN_NAV: readonly NavEntry[] = [
  { key: "home", label: "Home", href: HOME_HREF },
  { key: "new-hires", label: "New hires", href: "/new-hires", roles: ["hr"] },
  { key: "holidays", label: "Holidays", href: "/holidays", roles: ["hr"] },
];

export function brandHref(signedIn: boolean): string {
  return signedIn ? HOME_HREF : SIGN_IN_HREF;
}

/** Allow-list: an unknown or missing role sees only the unrestricted entries. */
export function visibleNav(signedIn: boolean, role?: string | null): readonly NavEntry[] {
  if (!signedIn) return [];
  return MAIN_NAV.filter((entry) => !entry.roles || (role != null && entry.roles.includes(role)));
}

export function isCurrent(entry: NavEntry, pathname: string): boolean {
  if (entry.href === HOME_HREF) return pathname === HOME_HREF;
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}
