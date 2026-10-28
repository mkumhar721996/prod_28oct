import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/navigation", () => ({ redirect }));

import { OrdersScreen } from "@/components/orders/OrdersScreen";
import OrdersPage from "./page";

describe("OrdersPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a signed-out visitor to sign-in, returning to Orders", async () => {
    getSession.mockResolvedValue(null);
    await expect(OrdersPage()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/sign-in?next=%2Forders");
  });

  it("renders the orders screen for a signed-in customer", async () => {
    getSession.mockResolvedValue({ role: "customer" });
    const el = await OrdersPage();
    expect(el.type).toBe(OrdersScreen);
    expect(redirect).not.toHaveBeenCalled();
  });
});
