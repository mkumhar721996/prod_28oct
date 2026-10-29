import { cookies } from "next/headers";

export type Session = { role: string; email?: string } | null;

// The browser reaches the /session/* paths on the web origin; next.config.ts rewrites them to the
// Records API, cookies included. The wallet is read server side, straight from the API.
// e2e seam: tests/e2e/mock-session-server.mjs stands in for the API and treats the forwarded
// `e2e-session=1` cookie as signed in.
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const SESSION_PATH = "/session";
const SIGN_OUT_PATH = "/session/sign-out";
const REGISTER_PATH = "/session/register";
const SIGN_IN_PATH = "/session/sign-in";
const WALLET_PATH = "/wallet";
// Under /api because /wallet is the page itself; next.config.ts rewrites it to POST /wallet/top-up.
const TOP_UP_PATH = "/api/wallet/top-up";

/** Server side: the current session, or null when signed out. Throws if the session service fails. */
export async function getSession(): Promise<Session> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${SESSION_PATH}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Session lookup failed (${res.status})`);
  return (await res.json()) as Session;
}

/** Server side: the signed-in player's own balance. Throws if the wallet cannot be read. */
export async function getWalletBalance(): Promise<number> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${WALLET_PATH}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`Wallet lookup failed (${res.status})`);
  return ((await res.json()) as { balanceCredits: number }).balanceCredits;
}

export type TopUp = { eligible: boolean; credits: number };
export type Wallet = { balanceCredits: number; topUp: TopUp };

/** Server side: the player's balance and whether a free top-up is available. Throws on failure. */
export async function getWallet(): Promise<Wallet> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${WALLET_PATH}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`Wallet lookup failed (${res.status})`);
  return (await res.json()) as Wallet;
}

export type HistoryKind = "grant" | "bet" | "win" | "topup";
export type HistoryRange = "recent" | "all";
/** `wallet` is every entry; `play` is bets and wins only. */
export type HistoryView = "wallet" | "play";
export type JackpotTier = "Grand" | "Major" | "Minor" | "Mini";
export type HistoryEntry = {
  id: string;
  kind: HistoryKind;
  amountCredits: number;
  balanceCredits: number;
  /** ISO-8601 UTC. */
  createdAt: string;
  /** Credits of a bet that fed the jackpot; null when none. */
  jackpotContributionCredits: number | null;
  /** Tier of a jackpot win; null for any other entry. */
  jackpotTier: JackpotTier | null;
};
export type WalletHistory = {
  entries: HistoryEntry[];
  page: number;
  pageCount: number;
  total: number;
  range: HistoryRange;
  view: HistoryView;
};

/** Server side: one page of the player's own history. Throws if it cannot be read. */
export async function getWalletHistory(
  page: number,
  range: HistoryRange,
  view: HistoryView,
): Promise<WalletHistory> {
  const cookieHeader = (await cookies()).toString();
  const query = new URLSearchParams({ page: String(page), range, view });
  const res = await fetch(`${API_URL}${WALLET_PATH}/history?${query}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`History lookup failed (${res.status})`);
  return (await res.json()) as WalletHistory;
}

export type ClaimResult =
  | { ok: true; balanceCredits: number; grantedCredits: number }
  | { ok: false; message?: string };

/** Client side: claims the free top-up. Never throws. */
export async function claimFreeCredits(): Promise<ClaimResult> {
  try {
    const res = await fetch(TOP_UP_PATH, { method: "POST", credentials: "include" });
    const body = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      balanceCredits?: number;
      grantedCredits?: number;
    };
    if (res.ok) {
      return {
        ok: true,
        balanceCredits: body.balanceCredits ?? 0,
        grantedCredits: body.grantedCredits ?? 0,
      };
    }
    return { ok: false, message: typeof body.message === "string" ? body.message : undefined };
  } catch {
    return { ok: false };
  }
}

export type AuthResult = { ok: true } | { ok: false; status: number; message: string };

const GENERIC_ERROR = "Something went wrong. Try again.";

async function postCredentials(path: string, email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { message?: unknown };
    const message = typeof body.message === "string" ? body.message : GENERIC_ERROR;
    return { ok: false, status: res.status, message };
  } catch {
    return { ok: false, status: 0, message: GENERIC_ERROR };
  }
}

/** Client side: creates the account and signs the visitor in. */
export function registerPlayer(email: string, password: string): Promise<AuthResult> {
  return postCredentials(REGISTER_PATH, email, password);
}

/** Client side: signs a player in. */
export function signInPlayer(email: string, password: string): Promise<AuthResult> {
  return postCredentials(SIGN_IN_PATH, email, password);
}

/** Client side: ends the session. Rejects on failure. */
export async function signOut(): Promise<void> {
  const res = await fetch(SIGN_OUT_PATH, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`Sign out failed (${res.status})`);
}
