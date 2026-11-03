import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "./cart";
import {
  newIdempotencyKey,
  placeOrder,
  submitOrder,
  validateCheckout,
  type AttemptMemo,
  type CheckoutForm,
  type PlaceOrderBody,
} from "./checkout";

const cart: Cart = [{ id: "p1", name: "Pizza", unitPrice: 900, quantity: 2, image: "/p1.jpg" }];
const collection: CheckoutForm = { fulfilment: "collection", name: "Ana", phone: "0123456789", address: "" };
const delivery: CheckoutForm = { ...collection, fulfilment: "delivery", address: "12 MG Road, Bengaluru, 560103" };

describe("validateCheckout", () => {
  it("requires a name (AC4)", () => {
    expect(validateCheckout({ ...collection, name: " " }).name).toBe("Enter your name");
  });

  it("requires a phone number (AC5)", () => {
    expect(validateCheckout({ ...collection, phone: "" }).phone).toMatch(/Enter a phone number/);
  });

  it("accepts 10 to 15 digits and refuses 9 and 16 (AC16, AC17)", () => {
    const phone = (p: string) => validateCheckout({ ...collection, phone: p }).phone;
    expect(phone("123456789")).toBeDefined();
    expect(phone("0123456789")).toBeUndefined();
    expect(phone("123456789012345")).toBeUndefined();
    expect(phone("1234567890123456")).toBeDefined();
    expect(phone("+91 98765-43210")).toBeUndefined();
  });

  it("asks for an address only for delivery (AC6, AC18)", () => {
    const address = (a: string) => validateCheckout({ ...delivery, address: a }).address;
    expect(address("")).toBe("Enter your address");
    expect(address("12 MG Road, Bengaluru")).toMatch(/street, city and a 6-digit PIN code/);
    expect(address("12 MG Road, Bengaluru, 5601")).toBeDefined();
    expect(address("12 MG Road, Bengaluru, 56010A")).toBeDefined();
    expect(address("12 MG Road, Bengaluru, 5601033")).toBeDefined();
    expect(address("12 MG Road, Bengaluru, 560103")).toBeUndefined();
    expect(validateCheckout({ ...collection, address: "" })).toEqual({});
  });
});

describe("newIdempotencyKey", () => {
  it("differs on each call", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});

describe("placeOrder", () => {
  afterEach(() => vi.unstubAllGlobals());
  const body: PlaceOrderBody = { fulfilment: "collection", name: "Ana", phone: "0123456789", lines: [], idempotencyKey: "k" };

  it("posts JSON with the session cookie and returns the order number", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ order: { id: "o1", number: "1001" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await placeOrder(body)).toEqual({ ok: true, number: "1001" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders",
      expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify(body) }),
    );
  });

  it("returns ok:false for a non-2xx answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    expect(await placeOrder(body)).toEqual({ ok: false });
  });

  it("returns ok:false instead of throwing on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await placeOrder(body)).toEqual({ ok: false });
  });
});

describe("submitOrder", () => {
  function setup(results: Array<{ ok: true; number: string } | { ok: false }> = [{ ok: true, number: "1001" }]) {
    const place = vi.fn(async (_b: PlaceOrderBody) => results.shift() ?? { ok: false as const });
    let n = 0;
    const deps = { placeOrder: place, newKey: () => `key-${++n}` };
    const memo: { current: AttemptMemo | null } = { current: null };
    return { place, deps, memo };
  }

  it("does not place an invalid order and reports the field errors (AC4-6, AC16-18)", async () => {
    const { place, deps, memo } = setup();
    const out = await submitOrder(deps, memo, { ...collection, name: "" }, cart);
    expect(out).toMatchObject({ type: "invalid", errors: { name: "Enter your name" } });
    expect(place).not.toHaveBeenCalled();
  });

  it("places a valid collection order with the cart lines and no address or image (AC8)", async () => {
    const { place, deps, memo } = setup();
    expect(await submitOrder(deps, memo, { ...collection, address: "ignored" }, cart)).toEqual({
      type: "placed",
      number: "1001",
    });
    expect(place).toHaveBeenCalledWith({
      fulfilment: "collection",
      name: "Ana",
      phone: "0123456789",
      lines: [{ id: "p1", name: "Pizza", unitPrice: 900, quantity: 2 }],
      idempotencyKey: "key-1",
    });
  });

  it("sends the address for delivery (AC19)", async () => {
    const { place, deps, memo } = setup();
    await submitOrder(deps, memo, delivery, cart);
    expect(place.mock.calls[0][0]).toMatchObject({ fulfilment: "delivery", address: "12 MG Road, Bengaluru, 560103" });
  });

  it("reports a failed order (AC12)", async () => {
    const { deps, memo } = setup([{ ok: false }]);
    expect(await submitOrder(deps, memo, collection, cart)).toEqual({ type: "failed" });
  });

  it("reuses the key for an unchanged retry, which then succeeds (AC15)", async () => {
    const { place, deps, memo } = setup([{ ok: false }, { ok: true, number: "1001" }]);
    await submitOrder(deps, memo, collection, cart);
    expect(await submitOrder(deps, memo, collection, cart)).toEqual({ type: "placed", number: "1001" });
    const keys = place.mock.calls.map(([b]) => b.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });

  it.each([
    ["name", { ...collection, name: "Anaa" }, cart],
    ["phone", { ...collection, phone: "01234567890" }, cart],
    ["fulfilment", delivery, cart],
    ["delivery address", { ...delivery, address: "1 High St, Pune, 411001" }, cart],
    ["cart quantity", collection, [{ ...cart[0], quantity: 3 }]],
    ["cart lines", collection, [...cart, { id: "p2", name: "Cola", unitPrice: 90, quantity: 1, image: "/c.jpg" }]],
  ])("mints a new key after a %s change", async (_label, form, nextCart) => {
    const start = _label === "delivery address" ? delivery : collection;
    const { place, deps, memo } = setup([{ ok: false }, { ok: false }]);
    await submitOrder(deps, memo, start, cart);
    await submitOrder(deps, memo, form, nextCart as Cart);
    const [first, second] = place.mock.calls.map(([b]) => b.idempotencyKey);
    expect(second).not.toBe(first);
  });

  it("keeps the key when only a collection order's hidden address text changes", async () => {
    const { place, deps, memo } = setup([{ ok: false }, { ok: false }]);
    await submitOrder(deps, memo, collection, cart);
    await submitOrder(deps, memo, { ...collection, address: "typed then hidden" }, cart);
    const [first, second] = place.mock.calls.map(([b]) => b.idempotencyKey);
    expect(second).toBe(first);
  });
});
