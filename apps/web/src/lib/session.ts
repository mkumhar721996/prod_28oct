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
