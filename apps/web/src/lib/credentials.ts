export const MIN_PASSWORD_LENGTH = 8;
export const EMAIL_ERROR = "Enter an email like name@example.com";
export const PASSWORD_ERROR = `Use at least ${MIN_PASSWORD_LENGTH} characters`;

/** Must match MAX_NAME_LENGTH in the API's players.constants.ts. */
export const MAX_NAME_LENGTH = 50;
export const NAME_REQUIRED_ERROR = "Enter your name";
export const NAME_LENGTH_ERROR = `Use ${MAX_NAME_LENGTH} characters or fewer`;

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return NAME_REQUIRED_ERROR;
  return trimmed.length > MAX_NAME_LENGTH ? NAME_LENGTH_ERROR : null;
}

/** The error to show for this email, or null when it is fine. */
export function validateEmail(email: string): string | null {
  return EMAIL_PATTERN.test(email.trim()) ? null : EMAIL_ERROR;
}

export function validatePassword(password: string): string | null {
  return password.length >= MIN_PASSWORD_LENGTH ? null : PASSWORD_ERROR;
}
