export type CartLine = { itemId: string; quantity: number };
export type CartAction = { type: "add"; itemId: string } | { type: "restore"; lines: CartLine[] };

export const CART_STORAGE_KEY = "cart";

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  if (action.type === "restore") return action.lines;
  if (lines.some((l) => l.itemId === action.itemId)) {
    return lines.map((l) => (l.itemId === action.itemId ? { ...l, quantity: l.quantity + 1 } : l));
  }
  return [...lines, { itemId: action.itemId, quantity: 1 }];
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Corrupt or missing storage means an empty cart. */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.every(
      (l) =>
        typeof l === "object" &&
        l !== null &&
        typeof l.itemId === "string" &&
        Number.isInteger(l.quantity) &&
        l.quantity > 0,
    );
    return valid ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}
