export const BETS = [10, 25, 50, 100, 250] as const;
export type Bet = (typeof BETS)[number];

/** Share of every bet that goes into the jackpot pool. */
export const CONTRIBUTION_PERCENT = 5;
/** How a contribution is split across the tiers, in percent; sums to 100. */
export const TIER_SHARES = { mini: 40, minor: 30, major: 20, grand: 10 } as const;

export const isBet = (value: unknown): value is Bet => BETS.some((b) => b === value);

export const insufficientMessage = (balance: number, bet: number) =>
  `Your balance of ${balance.toLocaleString('en-US')} does not cover a bet of ${bet}. Choose a lower bet.`;
