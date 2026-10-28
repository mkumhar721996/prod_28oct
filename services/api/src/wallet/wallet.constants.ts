export const MIN_BET = 1;
export const HISTORY_PAGE_SIZE = 10;
export const HISTORY_WINDOW_DAYS = 30;
/** A balance must be strictly above the minimum bet to bet; the free top-up uses the same threshold. */
export const canBet = (balance: number) => balance > MIN_BET;
