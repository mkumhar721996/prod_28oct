import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/navigation", () => ({ redirect }));

import CheckoutPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("CheckoutPage", () => {
  it("sends a guest to sign-in with next=checkout so they return here afterwards", async () => {
    getSession.mockResolvedValue(null);
    await expect(CheckoutPage()).rejects.toThrow("redirect:/sign-in?next=checkout");
  });

  it("shows the Checkout screen to a signed-in customer", async () => {
    getSession.mockResolvedValue({ role: "player" });
    const el = await CheckoutPage();
    expect(JSON.stringify(el)).toContain("Checkout");
  });
});
