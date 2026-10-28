import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, getSession, getWallet } = vi.hoisted(() => ({
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
  getSession: vi.fn(),
  getWallet: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/session", () => ({ getSession, getWallet, claimFreeCredits: vi.fn() }));

import WalletPage from "./page";

beforeEach(() => vi.clearAllMocks());

const signedIn = { role: "player", email: "ana@example.com" };

describe("WalletPage", () => {
  it("redirects a signed-out visitor to sign-in", async () => {
    getSession.mockResolvedValue(null);
    await expect(WalletPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/sign-in?next=wallet",
    );
    expect(getWallet).not.toHaveBeenCalled();
  });

  it("shows the balance, email and an unavailable claim panel", async () => {
    getSession.mockResolvedValue(signedIn);
    getWallet.mockResolvedValue({
      balanceCredits: 1000,
      topUp: { eligible: false, credits: 500 },
    });
    const html = renderToStaticMarkup(await WalletPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("1,000 credits");
    expect(html).toContain("Signed in as ana@example.com");
    expect(html).toContain("Free credits");
    expect(html).toContain("Not available");
    expect(html).not.toContain("Welcome!");
  });

  it("shows 1 credit and an available claim panel at a balance of 1", async () => {
    getSession.mockResolvedValue(signedIn);
    getWallet.mockResolvedValue({ balanceCredits: 1, topUp: { eligible: true, credits: 500 } });
    const html = renderToStaticMarkup(await WalletPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("1 credit<");
    expect(html).toContain("Available");
  });

  it("shows the welcome note right after registration", async () => {
    getSession.mockResolvedValue(signedIn);
    getWallet.mockResolvedValue({
      balanceCredits: 1000,
      topUp: { eligible: false, credits: 500 },
    });
    const html = renderToStaticMarkup(
      await WalletPage({ searchParams: Promise.resolve({ welcome: "1" }) }),
    );
    expect(html).toContain("Welcome! We added 1,000 credits to your new wallet.");
  });
});
