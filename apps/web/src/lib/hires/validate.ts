export type HireInput = { name: string; email: string; role: string; startDate: string };
export type HireErrors = Partial<Record<keyof HireInput, string>>;
export type Hire = HireInput & { id: string; status: "invited" };

export const ROLES = ["Engineer", "Designer", "Recruiter", "Finance"] as const;

export const DUPLICATE_EMAIL_MESSAGE = "A hire with this email already exists. Use a different email.";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateHire(input: HireInput): HireErrors {
  const errors: HireErrors = {};
  const email = input.email.trim();
  if (!input.name.trim()) errors.name = "Enter the new hire’s full name.";
  if (!email) errors.email = "Enter a work email like name@example.com.";
  else if (!EMAIL.test(email)) errors.email = "Enter an email like name@example.com.";
  if (!input.role) errors.role = "Choose a role.";
  if (!input.startDate) errors.startDate = "Choose a start date.";
  return errors;
}
