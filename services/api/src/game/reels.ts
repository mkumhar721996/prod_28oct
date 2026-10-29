export const SYMBOLS = ['cherry', 'bell', 'bar', 'seven'] as const;
export type Symbol = (typeof SYMBOLS)[number];
export type Reels = [Symbol, Symbol, Symbol];

/** `randomInt(max)` returns an integer in [0, max); production passes `crypto.randomInt`. */
export function drawReels(randomInt: (max: number) => number): Reels {
  const one = () => SYMBOLS[randomInt(SYMBOLS.length)];
  return [one(), one(), one()];
}

/**
 * PLACEHOLDER paytable, copied from the approved prototype. The payout story and the jackpot-symbols
 * story replace this body only; the spin transaction and the UI do not change.
 */
export function payoutFor(reels: Reels, bet: number): { winCredits: number; label: string | null } {
  const cherries = reels.filter((s) => s === 'cherry').length;
  if (reels.every((s) => s === 'bell')) {
    return { winCredits: bet * 10, label: 'Three bells pay 10× your bet.' };
  }
  if (cherries === 2) {
    return { winCredits: bet, label: 'Two cherries pay 1× your bet.' };
  }
  return { winCredits: 0, label: null };
}
