import { CONTRIBUTION_PERCENT, TIER_SHARES } from './game.constants';

/** Whole cents per jackpot tier. */
export type TierCents = { mini: number; minor: number; major: number; grand: number };

/**
 * What one bet adds to each tier. A bet of N credits contributes N x 5 cents; each tier takes its
 * share of that, rounded to the nearest cent with halves up, in integer arithmetic only.
 */
export function splitContribution(bet: number): TierCents {
  const part = (share: number) => Math.floor((bet * CONTRIBUTION_PERCENT * share + 50) / 100);
  return {
    mini: part(TIER_SHARES.mini),
    minor: part(TIER_SHARES.minor),
    major: part(TIER_SHARES.major),
    grand: part(TIER_SHARES.grand),
  };
}
