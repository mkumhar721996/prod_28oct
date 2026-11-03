export const SYMBOLS = ['cherry', 'bell', 'bar', 'seven'] as const;
export type Symbol = (typeof SYMBOLS)[number];
export type Reels = [Symbol, Symbol, Symbol];

/** `randomInt(max)` returns an integer in [0, max); production passes `crypto.randomInt`. */
export function drawReels(randomInt: (max: number) => number): Reels {
  const draw = () => SYMBOLS[randomInt(SYMBOLS.length)];
  return [draw(), draw(), draw()];
}

/**
 * PLACEHOLDER paytable: the payout story and the jackpot-symbols story replace this body only.
 * Two cherries pay 1x the bet, three bells pay 10x, anything else pays nothing.
 */
export function payoutFor(reels: Reels, bet: number): { winCredits: number; label: string | null } {
  if (reels.every((symbol) => symbol === 'bell')) {
    return { winCredits: bet * 10, label: 'Three bells pay 10× your bet.' };
  }
  if (reels.filter((symbol) => symbol === 'cherry').length === 2) {
    return { winCredits: bet, label: 'Two cherries pay 1× your bet.' };
  }
  return { winCredits: 0, label: null };
}
