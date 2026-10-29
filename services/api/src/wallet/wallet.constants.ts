export const MIN_BET = 1;
export const HISTORY_PAGE_SIZE = 10;
export const HISTORY_WINDOW_DAYS = 30;
export const TOP_UP_NOT_LOW_MESSAGE = `Free top-up is only available when your balance is ${MIN_BET} credit or less.`;
export const BET_ABOVE_BALANCE_MESSAGE = `Your bet is larger than your balance. You can bet up to your full balance. A free top-up is available when your balance is ${MIN_BET} credit or less.`;
export const INVALID_BET_MESSAGE = `Enter a whole number of credits, at least ${MIN_BET}.`;
/** Marks top-up eligibility (negated): a balance above the minimum is not low enough for the free top-up. */
export const canBet = (balance: number) => balance > MIN_BET;
