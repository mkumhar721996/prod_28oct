export type StaffAccount = {
  id: string;
  number: string;
  customerEmail: string;
  balanceCredits: number;
  frozen: boolean;
  frozenAt: string | null;
  frozenBy: string | null;
  freezeReason: string | null;
};

export type FreezeOutcome =
  | { ok: true; account: StaffAccount }
  | { ok: false; kind: "reason_required" | "error"; message: string };

export const REASON_REQUIRED_ERROR =
  "Enter a reason to freeze this account. The account has not been frozen.";
export const FREEZE_FAILED_ERROR = "The account could not be updated. Try again.";

// The browser calls /api/staff/accounts on the web origin; next.config.ts rewrites it (cookies
// included) to the API.
const ACCOUNTS_API_PATH = "/api/staff/accounts";

/** The reason problem for the freeze form, or null when the reason is usable. */
export function reasonError(reason: string): string | null {
  return reason.trim() ? null : REASON_REQUIRED_ERROR;
}

/** Accounts matching the customer email or account number. Rejects when the list cannot be loaded. */
export async function searchAccounts(query: string): Promise<StaffAccount[]> {
  const res = await fetch(`${ACCOUNTS_API_PATH}?q=${encodeURIComponent(query)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Account search failed (${res.status})`);
  return (await res.json()) as StaffAccount[];
}

async function change(id: string, action: "freeze" | "unfreeze", body?: object): Promise<FreezeOutcome> {
  try {
    const res = await fetch(`${ACCOUNTS_API_PATH}/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (res.ok) return { ok: true, account: (await res.json()) as StaffAccount };
    const data = (await res.json().catch(() => ({}))) as { code?: string };
    if (data.code === "reason_required") {
      return { ok: false, kind: "reason_required", message: REASON_REQUIRED_ERROR };
    }
  } catch {
    // fall through to the generic failure
  }
  return { ok: false, kind: "error", message: FREEZE_FAILED_ERROR };
}

/** Freezes one account; the API refuses a blank reason. */
export const freezeAccount = (id: string, reason: string) => change(id, "freeze", { reason });

/** Unfreezes one account; no reason is needed. */
export const unfreezeAccount = (id: string) => change(id, "unfreeze");
