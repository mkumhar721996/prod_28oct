/** Block fields are typed `unknown`; these narrow them without throwing on missing data. */
export function asString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    : [];
}
