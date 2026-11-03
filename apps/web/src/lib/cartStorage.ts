import type { Cart, CartLine } from "./cart";

export const CART_STORAGE_KEY = "cart";

export function serializeCart(cart: Cart): string {
  return JSON.stringify(cart);
}

function isLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.id === "string" &&
    typeof l.name === "string" &&
    typeof l.image === "string" &&
    typeof l.unitPrice === "number" &&
    Number.isFinite(l.unitPrice) &&
    typeof l.quantity === "number" &&
    Number.isInteger(l.quantity) &&
    l.quantity >= 1
  );
}

/** Tolerates null, bad JSON and bad shapes: a corrupted value gives an empty cart. */
export function parseCart(raw: string | null): Cart {
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) && data.every(isLine) ? data : [];
  } catch {
    return [];
  }
}
