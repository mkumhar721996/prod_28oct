import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/navigation", () => ({ redirect }));

import { OrderConfirmedScreen } from "@/components/orders/OrderConfirmedScreen";
import OrderConfirmedPage from "./page";

const params = (order?: string) => ({ searchParams: Promise.resolve({ order }) });

describe("OrderConfirmedPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a signed-out visitor to sign-in", async () => {
    getSession.mockResolvedValue(null);
    await expect(OrderConfirmedPage(params("AB12CD"))).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/sign-in?next=%2Forders");
  });

  it("sends a missing or malformed order number to Orders", async () => {
    getSession.mockResolvedValue({ role: "customer" });
    await expect(OrderConfirmedPage(params("bad"))).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenLastCalledWith("/orders");
    await expect(OrderConfirmedPage(params(undefined))).rejects.toThrow("REDIRECT");
  });

  it("renders the confirmation for a valid number", async () => {
    getSession.mockResolvedValue({ role: "customer" });
    const el = await OrderConfirmedPage(params("AB12CD"));
    expect(el.type).toBe(OrderConfirmedScreen);
    expect(el.props.orderNumber).toBe("AB12CD");
  });
});
