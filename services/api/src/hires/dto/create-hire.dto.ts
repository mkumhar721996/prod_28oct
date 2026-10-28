export const ROLES = ['Engineer', 'Designer', 'Recruiter', 'Finance'] as const;

export const DUPLICATE_EMAIL_MESSAGE = 'A hire with this email already exists. Use a different email.';

export type CreateHireDto = { name: string; email: string; role: string; startDate: string };
export type CreateHireErrors = Partial<Record<keyof CreateHireDto, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Validates an untrusted body; returns the cleaned dto or every field error at once. */
export function parseCreateHire(
  body: unknown,
): { dto: CreateHireDto; errors?: undefined } | { dto?: undefined; errors: CreateHireErrors } {
  const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string).trim() : '');
  const dto: CreateHireDto = {
    name: str('name'),
    email: str('email'),
    role: str('role'),
    startDate: str('startDate'),
  };
  const errors: CreateHireErrors = {};
  if (!dto.name) errors.name = 'Enter the new hire’s full name.';
  if (!dto.email) errors.email = 'Enter a work email like name@example.com.';
  else if (!EMAIL.test(dto.email)) errors.email = 'Enter an email like name@example.com.';
  if (!(ROLES as readonly string[]).includes(dto.role)) errors.role = 'Choose a role.';
  if (!isRealDate(dto.startDate)) errors.startDate = 'Choose a start date.';
  return Object.keys(errors).length ? { errors } : { dto };
}
