/** The bets a player may choose from. */
export const BETS = [10, 25, 50, 100, 250] as const;
export type Bet = (typeof BETS)[number];

/** Share of every bet that goes to the jackpot pool, in percent. */
export const CONTRIBUTION_PERCENT = 5;

/** How the contribution is split across the four jackpot tiers, in percent. */
export const TIER_SHARES = { mini: 40, minor: 30, major: 20, grand: 10 } as const;

export const isBet = (value: unknown): value is Bet => BETS.some((bet) => bet === value);
