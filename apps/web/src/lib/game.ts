import { cookies } from "next/headers";

// Client components import spinOnce from here too; `cookies` is only ever called by getGame on the server.
// Server side reads the API directly (forwarding the session cookie); the browser posts to
// /api/game/spin on the web origin and next.config.ts rewrites it to the API. Under /api because
// /play is the page itself.
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const GAME_PATH = "/game";
const SPIN_PATH = "/api/game/spin";

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
  | { ok: false; kind: "insufficient" | "failed"; message?: string; balanceCredits?: number };

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
    if (res.ok) return { ok: true, ...body } as SpinOutcome;
    const message = typeof body.message === "string" ? body.message : undefined;
    const balanceCredits = typeof body.balanceCredits === "number" ? body.balanceCredits : undefined;
    return { ok: false, kind: res.status === 409 ? "insufficient" : "failed", message, balanceCredits };
  } catch {
    return { ok: false, kind: "failed" };
  }
}

export const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function resultMessage(o: { bet: number; winCredits: number; label: string | null }): {
  tone: "success" | "info";
  text: string;
} {
  if (o.winCredits > 0) {
    return { tone: "success", text: `You win ${o.winCredits.toLocaleString("en-US")}. ${o.label ?? ""}`.trim() };
  }
  return { tone: "info", text: `No win this time. You bet ${o.bet}. Try again.` };
}

/** A player may wager their whole balance. */
export const canCover = (balance: number, bet: number) => balance >= bet;
