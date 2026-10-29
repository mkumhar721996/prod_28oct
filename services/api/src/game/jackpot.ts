import { CONTRIBUTION_PERCENT, TIER_SHARES } from './game.constants';

export type TierCents = { mini: number; minor: number; major: number; grand: number };

/**
 * A bet's jackpot contribution in whole cents per tier. Bet credits x 5% is `bet x 5` cents; each
 * tier takes its share of that, with a half cent rounded up (integer arithmetic only).
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
