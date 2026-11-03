import type { Cart } from "./cart";

// Keep in sync with the rules in services/api/src/orders/orders.validation.ts (the API refuses what fails here too).
const PHONE_DIGITS = /^\d{10,15}$/;
const PIN_CODE = /^\d{6}$/;

export type Fulfilment = "delivery" | "collection";
export type CheckoutForm = { fulfilment: Fulfilment; name: string; phone: string; address: string };
export type CheckoutErrors = Partial<Record<"name" | "phone" | "address", string>>;
export type OrderLineBody = { id: string; name: string; unitPrice: number; quantity: number };
export type PlaceOrderBody = {
  fulfilment: Fulfilment;
  name: string;
  phone: string;
  address?: string;
  lines: OrderLineBody[];
  idempotencyKey: string;
};
export type PlaceOrderResult = { ok: true; number: string } | { ok: false };

// The browser calls /api/orders on the web origin; next.config.ts rewrites it (cookies included) to the API.
const ORDERS_API_PATH = "/api/orders";

function phoneValid(phone: string): boolean {
  return PHONE_DIGITS.test(phone.trim().replace(/^\+/, "").replace(/[\s\-.()[\]]/g, ""));
}

function addressMessage(address: string): string | undefined {
  if (address.trim() === "") return "Enter your address";
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length < 3 || parts.some((p) => p === "") || !PIN_CODE.test(parts[parts.length - 1])) {
    return "Enter an address with street, city and a 6-digit PIN code";
  }
  return undefined;
}

/** Field errors for Place order; an empty object means the form can be sent. */
export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (form.name.trim() === "") errors.name = "Enter your name";
  if (!phoneValid(form.phone)) errors.phone = "Enter a phone number with 10 to 15 digits";
  if (form.fulfilment === "delivery") {
    const address = addressMessage(form.address);
    if (address) errors.address = address;
  }
  return errors;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Client side: places the order. Never throws; any failure is `{ ok: false }`. */
export async function placeOrder(input: PlaceOrderBody): Promise<PlaceOrderResult> {
  try {
    const res = await fetch(ORDERS_API_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { order?: { number?: unknown } };
    const number = body.order?.number;
    return typeof number === "string" ? { ok: true, number } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** The key and payload signature of the last attempt, so an unchanged retry reuses its key. */
export type AttemptMemo = { key: string; signature: string };

/** Everything the order depends on: contact details, fulfilment, address (delivery only) and cart lines. */
export function orderSignature(form: CheckoutForm, cart: Cart): string {
  return JSON.stringify([
    form.fulfilment,
    form.name,
    form.phone,
    form.fulfilment === "delivery" ? form.address : null,
    cart.map((l) => [l.id, l.quantity]),
  ]);
}

export type SubmitOutcome =
  | { type: "invalid"; errors: CheckoutErrors }
  | { type: "placed"; number: string }
  | { type: "failed" };

/**
 * Validates, then places the order. An unchanged retry after a failure reuses the idempotency key
 * (a lost response cannot double-create); any edit to the details or the cart mints a new one.
 */
export async function submitOrder(
  deps: { placeOrder: typeof placeOrder; newKey: () => string },
  memo: { current: AttemptMemo | null },
  form: CheckoutForm,
  cart: Cart,
): Promise<SubmitOutcome> {
  const errors = validateCheckout(form);
  if (Object.keys(errors).length > 0) return { type: "invalid", errors };

  const signature = orderSignature(form, cart);
  if (memo.current?.signature !== signature) memo.current = { key: deps.newKey(), signature };
  const delivery = form.fulfilment === "delivery";
  const result = await deps.placeOrder({
    fulfilment: form.fulfilment,
    name: form.name.trim(),
    phone: form.phone.trim(),
    ...(delivery ? { address: form.address.trim() } : {}),
    lines: cart.map(({ id, name, unitPrice, quantity }) => ({ id, name, unitPrice, quantity })),
    idempotencyKey: memo.current.key,
  });
  return result.ok ? { type: "placed", number: result.number } : { type: "failed" };
}
