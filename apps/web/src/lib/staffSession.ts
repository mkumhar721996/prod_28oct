import { cookies } from "next/headers";
import { getSession, postCredentials, type AuthResult } from "./session";

export type StaffAccess =
  | { status: "staff"; email: string }
  | { status: "refused"; reason: "signed-out" | "customer" | "expired" };

// Like lib/session.ts: next.config.ts rewrites /staff/session/* to the Records API, cookies included.
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const STAFF_SESSION_PATH = "/staff/session";
const STAFF_SIGN_IN_PATH = "/staff/session/sign-in";
const STAFF_REGISTER_PATH = "/staff/session/register";
const STAFF_SIGN_OUT_PATH = "/staff/session/sign-out";
const UNAUTHORIZED = 401;

/**
 * Server side: who may open back-office pages. Only a 200 from the staff session is `staff`; a
 * failed or unexpected lookup throws, so it can never resolve to staff.
 */
export async function getStaffAccess(): Promise<StaffAccess> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${STAFF_SESSION_PATH}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (res.ok) return { status: "staff", email: ((await res.json()) as { email: string }).email };
  if (res.status !== UNAUTHORIZED) throw new Error(`Staff session lookup failed (${res.status})`);
  const body = (await res.json().catch(() => ({}))) as { reason?: unknown };
  if (body.reason === "expired") return { status: "refused", reason: "expired" };
  if (body.reason !== "signed-out") throw new Error("Staff session lookup failed (unknown refusal)");
  return (await getSession()) === null
    ? { status: "refused", reason: "signed-out" }
    : { status: "refused", reason: "customer" };
}

/** Client side: signs staff in on the staff sign-in. */
export function signInStaff(email: string, password: string): Promise<AuthResult> {
  return postCredentials(STAFF_SIGN_IN_PATH, email, password);
}

/** Client side: always refused by the API; staff accounts are created by an administrator. */
export function registerStaff(email: string, password: string): Promise<AuthResult> {
  return postCredentials(STAFF_REGISTER_PATH, email, password);
}

/** Client side: ends the staff session. Rejects on failure. */
export async function signOutStaff(): Promise<void> {
  const res = await fetch(STAFF_SIGN_OUT_PATH, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`Staff sign out failed (${res.status})`);
}
