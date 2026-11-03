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
export const ONBOARDING_TEMPLATES_HREF = "/onboarding-templates";
export const NEW_ONBOARDING_TEMPLATE_HREF = "/onboarding-templates/new";
export const MENU_HREF = "/menu";
export const LOBBY_HREF = "/lobby";
export const CHECKOUT_HREF = "/checkout";
/** Back-office pages: deliberately not in MAIN_NAV or NEXT_TARGETS, so customers are never sent there. */
export const BACK_OFFICE_HREF = "/back-office";
export const STAFF_SIGN_IN_HREF = "/back-office/sign-in";
export const STAFF_REGISTER_HREF = "/back-office/register";
/** Temporary: the Play screen does not exist yet. Point this at the Play route when that feature ships. */
export const PLACE_BET_HREF = WALLET_HREF;

/** Where sign-in may send a patient back to; anything else (open redirects) falls back to the wallet. */
const NEXT_TARGETS: Record<string, string> = {
  wallet: WALLET_HREF,
  history: HISTORY_HREF,
  [ORDERS_HREF]: ORDERS_HREF,
  [APPOINTMENTS_HREF]: APPOINTMENTS_HREF,
  [BOOK_APPOINTMENT_HREF]: BOOK_APPOINTMENT_HREF,
  checkout: CHECKOUT_HREF,
  [ONBOARDING_TEMPLATES_HREF]: ONBOARDING_TEMPLATES_HREF,
};

export function signInTarget(next: string | undefined): string {
  return (next !== undefined && Object.hasOwn(NEXT_TARGETS, next) && NEXT_TARGETS[next]) || WALLET_HREF;
}

export type NavEntry = { key: string; label: string; href: string; public?: true };

/** Append new sections to the end so existing positions stay stable. */
export const MAIN_NAV: readonly NavEntry[] = [
  { key: "home", label: "Home", href: HOME_HREF },
  { key: "wallet", label: "Wallet", href: WALLET_HREF },
  { key: "orders", label: "Orders", href: ORDERS_HREF },
  { key: "history", label: "History", href: HISTORY_HREF },
  { key: "appointments", label: "Appointments", href: APPOINTMENTS_HREF },
  { key: "menu", label: "Menu", href: MENU_HREF, public: true },
  { key: "onboarding-templates", label: "Templates", href: ONBOARDING_TEMPLATES_HREF },
  { key: "lobby", label: "Lobby", href: LOBBY_HREF, public: true },
];

export function brandHref(signedIn: boolean): string {
  return signedIn ? HOME_HREF : SIGN_IN_HREF;
}

export function visibleNav(signedIn: boolean): readonly NavEntry[] {
  return signedIn ? MAIN_NAV : MAIN_NAV.filter((entry) => entry.public);
}

export function isCurrent(entry: NavEntry, pathname: string): boolean {
  if (entry.href === HOME_HREF) return pathname === HOME_HREF;
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}
