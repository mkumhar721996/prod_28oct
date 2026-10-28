import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, getSession, getWalletBalance } = vi.hoisted(() => ({
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
  getSession: vi.fn(),
  getWalletBalance: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/session", () => ({ getSession, getWalletBalance }));

import WalletPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("WalletPage", () => {
  it("redirects a signed-out visitor to sign-in", async () => {
    getSession.mockResolvedValue(null);
    await expect(WalletPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/sign-in?next=wallet",
    );
    expect(getWalletBalance).not.toHaveBeenCalled();
  });

  it("shows the player's own balance and email", async () => {
    getSession.mockResolvedValue({ role: "player", email: "ana@example.com" });
    getWalletBalance.mockResolvedValue(1000);
    const html = renderToStaticMarkup(await WalletPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("1,000 credits");
    expect(html).toContain("Signed in as ana@example.com");
    expect(html).not.toContain("Welcome!");
  });

  it("shows the welcome note right after registration", async () => {
    getSession.mockResolvedValue({ role: "player", email: "ana@example.com" });
    getWalletBalance.mockResolvedValue(1000);
    const html = renderToStaticMarkup(
      await WalletPage({ searchParams: Promise.resolve({ welcome: "1" }) }),
    );
    expect(html).toContain("Welcome! We added 1,000 credits to your new wallet.");
  });
});
