import { Logger } from '@nestjs/common';

export const DEFAULT_TOP_UP_CREDITS = 500;
export const INVALID_TOP_UP_WARNING =
  'Invalid WALLET_TOP_UP_CREDITS value detected. Falling back to default value: 500.';

/**
 * WALLET_TOP_UP_CREDITS. Unset or empty means 500 with no warning. A value that is not a whole
 * number of 1 or more logs INVALID_TOP_UP_WARNING and returns 500. Never throws.
 */
export function topUpCredits(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = (m) => new Logger('WalletConfig').warn(m),
): number {
  const raw = env.WALLET_TOP_UP_CREDITS?.trim();
  if (!raw) return DEFAULT_TOP_UP_CREDITS;
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (Number.isSafeInteger(value) && value >= 1) return value;
  warn(INVALID_TOP_UP_WARNING);
  return DEFAULT_TOP_UP_CREDITS;
}
