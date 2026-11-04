import { cookies } from "next/headers";
import { postCredentials, type AuthResult } from "./session";

export type Role = "super_admin" | "staff" | "fundraising_consultant";
export type CurrentUser = { email: string; role: Role };

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super-admin",
  staff: "Staff",
  fundraising_consultant: "Fundraising Consultant",
};

// Like lib/staffSession.ts: next.config.ts rewrites /auth/session/* to the Records API, cookies included.
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const AUTH_SESSION_PATH = "/auth/session";
const AUTH_SIGN_IN_PATH = "/auth/session/sign-in";
const AUTH_SIGN_OUT_PATH = "/auth/session/sign-out";
const UNAUTHORIZED = 401;

/** Server side: the signed-in user, or null when signed out or expired. Any other failure throws. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${AUTH_SESSION_PATH}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (res.status === UNAUTHORIZED) return null;
  if (!res.ok) throw new Error(`Session lookup failed (${res.status})`);
  return (await res.json()) as CurrentUser;
}

/** Client side: signs a user in. */
export function signInUser(email: string, password: string): Promise<AuthResult> {
  return postCredentials(AUTH_SIGN_IN_PATH, email, password);
}

/** Client side: ends the session. Never throws; the caller goes to the sign-in page either way. */
export async function signOutUser(): Promise<void> {
  await fetch(AUTH_SIGN_OUT_PATH, { method: "POST", credentials: "include" }).catch(() => undefined);
}

/** Client side: is the session still live? `status` 401 means it ended. */
export async function checkSession(): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(AUTH_SESSION_PATH, { credentials: "include", cache: "no-store" });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
