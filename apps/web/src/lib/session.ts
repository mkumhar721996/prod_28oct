export type Session = { role: string } | null;

// Seam for the Invitations, sign-in and roles story: it replaces these bodies, not the signatures.
// The endpoints below are assumed until that story defines them.
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const SESSION_PATH = "/session";
const SIGN_OUT_PATH = "/session/sign-out";

/** Server side: the current session, or null when signed out (or no session service is reachable). */
export async function getSession(): Promise<Session> {
  try {
    const res = await fetch(`${API_URL}${SESSION_PATH}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Session;
  } catch {
    return null;
  }
}

/** Client side: ends the session. Rejects on failure. */
export async function signOut(): Promise<void> {
  const res = await fetch(SIGN_OUT_PATH, { method: "POST" });
  if (!res.ok) throw new Error(`Sign out failed (${res.status})`);
}
