import { cookies } from "next/headers";
import type { Role } from "./orgSession";

export type OrganizationSummary = { id: string; name: string };
export type Organization = { id: string; name: string; address: string };
export type Account = { id: string; email: string; role: Role };

/** What a client call answers; `status` 401 means the session ended. Never thrown. */
export type ActionResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string };

const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
// Under /api because /organizations and /accounts are the pages themselves; next.config.ts rewrites them.
const ORGANIZATIONS_PATH = "/api/organizations";
const ACCOUNTS_PATH = "/api/accounts";
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const GENERIC_ERROR = "Something went wrong. Try again.";

async function serverGet<T>(path: string): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  // Signed out or not found: no data. Anything else unexpected must not look like "no data".
  if (res.status === UNAUTHORIZED || res.status === NOT_FOUND) return null;
  if (!res.ok) throw new Error(`Lookup of ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

/** Server side: the organization names, or null when signed out. */
export const getOrganizations = () => serverGet<OrganizationSummary[]>("/organizations");

/** Server side: one organization, or null when signed out or missing. */
export const getOrganization = (id: string) =>
  serverGet<Organization>(`/organizations/${encodeURIComponent(id)}`);

/** Server side: every account, or null when signed out. Super-admin only; others throw (403). */
export const getAccounts = () => serverGet<Account[]>("/accounts");

async function send<T>(method: string, path: string, body?: unknown): Promise<ActionResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) {
      const value = res.status === 204 ? undefined : await res.json().catch(() => undefined);
      return { ok: true, value: value as T };
    }
    const parsed = (await res.json().catch(() => ({}))) as { message?: unknown };
    const message = typeof parsed.message === "string" ? parsed.message : GENERIC_ERROR;
    return { ok: false, status: res.status, message };
  } catch {
    return { ok: false, status: 0, message: GENERIC_ERROR };
  }
}

/** Client side: the only way an edit is stored. */
export const saveOrganization = (id: string, edit: { name: string; address: string }) =>
  send<Organization>("PATCH", `${ORGANIZATIONS_PATH}/${encodeURIComponent(id)}`, edit);

export const deleteOrganization = (id: string) =>
  send<undefined>("DELETE", `${ORGANIZATIONS_PATH}/${encodeURIComponent(id)}`);

export const createAccount = (account: { email: string; password: string; role: Role }) =>
  send<Account>("POST", ACCOUNTS_PATH, account);
