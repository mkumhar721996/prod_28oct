/** The one place the brand text lives; change it here and the header (and page title) follow. */
export const BRAND_NAME = "Web App";
export const HOME_HREF = "/";
export const ORDERS_HREF = "/orders";
export const SIGN_IN_HREF = "/sign-in";
export const REGISTER_HREF = "/register";
export const WALLET_HREF = "/wallet";
export const HISTORY_HREF = "/history";
export const APPOINTMENTS_HREF = "/appointments";
export const BOOK_APPOINTMENT_HREF = "/appointments/book";
/** Temporary: the Play screen does not exist yet. Point this at the Play route when that feature ships. */
export const PLACE_BET_HREF = WALLET_HREF;

export type NavEntry = { key: string; label: string; href: string };

/** Append new sections to the end so existing positions stay stable. */
export const MAIN_NAV: readonly NavEntry[] = [
  { key: "home", label: "Home", href: HOME_HREF },
  { key: "wallet", label: "Wallet", href: WALLET_HREF },
  { key: "orders", label: "Orders", href: ORDERS_HREF },
  { key: "history", label: "History", href: HISTORY_HREF },
  { key: "appointments", label: "Appointments", href: APPOINTMENTS_HREF },
];

export function brandHref(signedIn: boolean): string {
  return signedIn ? HOME_HREF : SIGN_IN_HREF;
}

export function visibleNav(signedIn: boolean): readonly NavEntry[] {
  return signedIn ? MAIN_NAV : [];
}

export function isCurrent(entry: NavEntry, pathname: string): boolean {
  if (entry.href === HOME_HREF) return pathname === HOME_HREF;
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}
