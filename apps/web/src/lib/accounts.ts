import { cookies } from "next/headers";

// Same seams as lib/session.ts: the page reads server side, straight from the API; the browser posts
// to /api/transfers on the web origin, which next.config.ts rewrites to POST /transfers.
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const ACCOUNTS_PATH = "/accounts";
// Under /api because /transfer is the page itself.
const TRANSFERS_PATH = "/api/transfers";

export type AccountKind = "checking" | "savings";
export type Account = { id: string; kind: AccountKind; balance: number; frozen: boolean };

export const ACCOUNT_LABELS: Record<AccountKind, string> = { checking: "Checking", savings: "Savings" };

export type TransferRefusalReason =
  | "invalid_amount"
  | "same_account"
  | "insufficient_balance"
  | "source_frozen"
  | "destination_frozen"
  | "not_found";

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  idempotencyKey: string;
};
export type AccountBalance = { id: string; balance: number };
export type TransferOutcome =
  | { ok: true; from: AccountBalance; to: AccountBalance; reference: string; replayed: boolean }
  | { ok: false; reason?: TransferRefusalReason; message: string };

export const TRANSFER_FAILED = "Couldn't make the transfer. Try again.";

/** Server side: the signed-in player's own accounts. Throws if they cannot be read. */
export async function getAccounts(): Promise<Account[]> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${ACCOUNTS_PATH}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`Accounts lookup failed (${res.status})`);
  return (await res.json()) as Account[];
}

/** Client side: confirms a transfer. Never throws. */
export async function submitTransfer(input: TransferInput): Promise<TransferOutcome> {
  try {
    const res = await fetch(TRANSFERS_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      reason?: TransferRefusalReason;
      from?: AccountBalance;
      to?: AccountBalance;
      reference?: string;
      replayed?: boolean;
    };
    if (res.ok && body.from && body.to) {
      return {
        ok: true,
        from: body.from,
        to: body.to,
        reference: body.reference ?? "",
        replayed: body.replayed ?? false,
      };
    }
    return {
      ok: false,
      reason: body.reason,
      message: typeof body.message === "string" ? body.message : TRANSFER_FAILED,
    };
  } catch {
    return { ok: false, message: TRANSFER_FAILED };
  }
}

/** One key per review/confirm attempt: the server applies a repeated key once. */
export const newIdempotencyKey = (): string => crypto.randomUUID();
