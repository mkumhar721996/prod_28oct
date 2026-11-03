export const MIN_PASSWORD_LENGTH = 8;
export const EMAIL_ERROR = "Enter an email like name@example.com";
export const PASSWORD_ERROR = `Use at least ${MIN_PASSWORD_LENGTH} characters`;

export const EMAIL_REQUIRED_ERROR = "Enter your email";
export const PASSWORD_REQUIRED_ERROR = "Enter your password";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** The error to show for this email, or null when it is fine. */
export function validateEmail(email: string): string | null {
  return EMAIL_PATTERN.test(email.trim()) ? null : EMAIL_ERROR;
}

export function validatePassword(password: string): string | null {
  return password.length >= MIN_PASSWORD_LENGTH ? null : PASSWORD_ERROR;
}

/** Sign-in checks emptiness only: the API alone judges an existing player's credentials. */
export function validateSignInEmailRequired(email: string): string | null {
  return email.trim() === "" ? EMAIL_REQUIRED_ERROR : null;
}

export function validateSignInPasswordRequired(password: string): string | null {
  return password === "" ? PASSWORD_REQUIRED_ERROR : null;
}
