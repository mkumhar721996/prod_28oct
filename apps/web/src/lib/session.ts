import { cookies } from "next/headers";

export type Session = { role: string } | null;

// Seam for the Invitations, sign-in and roles story: it replaces these bodies, not the signatures.
// The endpoints below are assumed until that story defines them. The browser reaches SIGN_OUT_PATH
// on the web origin; next.config.ts rewrites /session/* to the API.
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const SESSION_PATH = "/session";
const SIGN_OUT_PATH = "/session/sign-out";

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

/** Client side: ends the session. Rejects on failure. */
export async function signOut(): Promise<void> {
  const res = await fetch(SIGN_OUT_PATH, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`Sign out failed (${res.status})`);
}
