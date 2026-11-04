/** Credits granted once, in the same transaction that creates the account. */
export const STARTING_GRANT = 1000;
/** Opening balance of each new checking and savings account (whole units). */
export const OPENING_BALANCE = 0;
export const MIN_PASSWORD_LENGTH = 8;
/** Bounds the scrypt work a single request can demand. */
export const MAX_PASSWORD_LENGTH = 128;
export const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
