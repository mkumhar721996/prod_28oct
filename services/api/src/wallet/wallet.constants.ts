export const MIN_BET = 1;
export const HISTORY_PAGE_SIZE = 10;
export const HISTORY_WINDOW_DAYS = 30;
export const TOP_UP_NOT_LOW_MESSAGE = `Free top-up is only available when your balance is ${MIN_BET} credit or less.`;
export const BET_ABOVE_BALANCE_MESSAGE = 'Your bet is larger than your balance.';
export const INVALID_BET_MESSAGE = 'Enter a whole number of credits to bet.';
/** True above the minimum balance, i.e. not low enough for the free top-up (it does not gate betting). */
export const canBet = (balance: number) => balance > MIN_BET;
