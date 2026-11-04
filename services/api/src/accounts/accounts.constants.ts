export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

export type AccountKind = 'checking' | 'savings';
export const ACCOUNT_KINDS: readonly AccountKind[] = ['checking', 'savings'];
export const ACCOUNT_LABELS: Record<AccountKind, string> = { checking: 'Checking', savings: 'Savings' };

/** Why a transfer was not made. Shared with the payee payment story. */
export type TransferRefusal =
  | 'invalid_amount'
  | 'same_account'
  | 'insufficient_balance'
  | 'source_frozen'
  | 'destination_frozen'
  | 'not_found';

export type RefusalContext = {
  sourceLabel?: string;
  destinationLabel?: string;
  available?: number;
  amount?: number;
};

/** Plain refusal messages; each starts "Transfer not made." so the screen can state it. */
export function refusalMessage(reason: TransferRefusal, c: RefusalContext = {}): string {
  const prefix = 'Transfer not made.';
  switch (reason) {
    case 'insufficient_balance':
      return `${prefix} ${c.sourceLabel ?? 'The from account'} does not have ${c.amount} available. Enter ${c.available} or less.`;
    case 'source_frozen':
      return `${prefix} ${c.sourceLabel ?? 'The from account'} is frozen, so money cannot move in or out.`;
    case 'destination_frozen':
      return `${prefix} ${c.destinationLabel ?? 'The to account'} is frozen, so money cannot move in or out.`;
    case 'same_account':
      return `${prefix} Choose two different accounts.`;
    case 'invalid_amount':
      return `${prefix} Enter a whole number of 1 or more.`;
    case 'not_found':
      return `${prefix} We could not find one of the accounts.`;
  }
}
