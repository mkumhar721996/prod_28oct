// Keep in sync with apps/web/src/lib/checkout.ts and the checks in migrations/004_orders.sql.
const PHONE_DIGITS = /^\d{10,15}$/;
const PIN_CODE = /^\d{6}$/;

/** True when the phone is not 10 to 15 digits once spaces, hyphens, dots, brackets and a leading + are ignored. */
export function phoneError(phone: string): boolean {
  const trimmed = phone.trim().replace(/^\+/, '');
  return !PHONE_DIGITS.test(trimmed.replace(/[\s\-.()[\]]/g, ''));
}

/** True when the address is not street, city and a 6-digit Indian PIN code, comma separated. */
export function addressError(address: string): boolean {
  const parts = address.split(',').map((p) => p.trim());
  return parts.length < 3 || parts.some((p) => p === '') || !PIN_CODE.test(parts[parts.length - 1]);
}

export const LIMITS = {
  lines: 50,
  quantity: 99,
  name: 100,
  phone: 30,
  address: 300,
  lineId: 100,
  lineName: 200,
  idempotencyKey: 100,
} as const;

export const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim() !== '' && v.length <= max;

export function isValidLine(line: unknown): boolean {
  if (typeof line !== 'object' || line === null) return false;
  const l = line as Record<string, unknown>;
  return (
    isText(l.id, LIMITS.lineId) &&
    isText(l.name, LIMITS.lineName) &&
    typeof l.unitPrice === 'number' &&
    Number.isFinite(l.unitPrice) &&
    l.unitPrice >= 0 &&
    Number.isInteger(l.quantity) &&
    (l.quantity as number) >= 1 &&
    (l.quantity as number) <= LIMITS.quantity
  );
}
