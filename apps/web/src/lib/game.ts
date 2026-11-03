import { cookies } from "next/headers";

export const BETS = [10, 25, 50, 100, 250] as const;

export type JackpotCents = {
  miniCents: number;
  minorCents: number;
  majorCents: number;
  grandCents: number;
  totalCents: number;
};
export type GameState = { balanceCredits: number; jackpot: JackpotCents };

export type SpinOutcome =
  | {
      ok: true;
      reels: string[];
      bet: number;
      winCredits: number;
      label: string | null;
      balanceCredits: number;
      jackpot: JackpotCents;
    }
  | { ok: false; kind: "insufficient"; message?: string; balanceCredits?: number }
  | { ok: false; kind: "failed" };

// Same split as lib/session.ts: the page reads the game server side straight from the API, the
// browser spins through the /api/game/spin rewrite in next.config.ts (/play is the page itself).
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const GAME_PATH = "/game";
const SPIN_PATH = "/api/game/spin";

/** Server side: the player's balance and the jackpot pool. Throws if they cannot be read. */
export async function getGame(): Promise<GameState> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${GAME_PATH}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`Game lookup failed (${res.status})`);
  return (await res.json()) as GameState;
}

/** Client side: one spin, settled by the API. Never throws. */
export async function spinOnce(bet: number): Promise<SpinOutcome> {
  try {
    const res = await fetch(SPIN_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bet }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, ...(body as Omit<Extract<SpinOutcome, { ok: true }>, "ok">) };
    if (res.status === 409) {
      return {
        ok: false,
        kind: "insufficient",
        message: typeof body.message === "string" ? body.message : undefined,
        balanceCredits: typeof body.balanceCredits === "number" ? body.balanceCredits : undefined,
      };
    }
    return { ok: false, kind: "failed" };
  } catch {
    return { ok: false, kind: "failed" };
  }
}

export const formatAmount = (credits: number) => credits.toLocaleString("en-US");

export const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const canCover = (balance: number, bet: number) => balance >= bet;

export const insufficientMessage = (balance: number, bet: number) =>
  `Your balance of ${formatAmount(balance)} does not cover a bet of ${bet}. Choose a lower bet.`;

/** Win and loss differ in text and tone (so, in icon), never by colour alone. */
export function resultMessage(o: { bet: number; winCredits: number; label: string | null }): {
  tone: "success" | "info";
  text: string;
} {
  if (o.winCredits > 0) {
    return { tone: "success", text: `You win ${formatAmount(o.winCredits)}. ${o.label ?? ""}`.trim() };
  }
  return { tone: "info", text: `No win this time. You bet ${o.bet}. Try again.` };
}
