import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, getSession, getGame } = vi.hoisted(() => ({
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
  getSession: vi.fn(),
  getGame: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/game", async (importOriginal) => ({ ...(await importOriginal<object>()), getGame }));

import PlayPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("PlayPage", () => {
  it("redirects a signed-out visitor to sign-in without reading the game", async () => {
    getSession.mockResolvedValue(null);
    await expect(PlayPage()).rejects.toThrow("redirect:/sign-in?next=play");
    expect(getGame).not.toHaveBeenCalled();
  });

  it("renders the game with the player's balance and the pool", async () => {
    getSession.mockResolvedValue({ role: "player", email: "ana@example.com" });
    getGame.mockResolvedValue({
      balanceCredits: 1000,
      jackpot: { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 },
    });
    const html = renderToStaticMarkup(await PlayPage());
    expect(html).toContain("Jackpot slots");
    expect(html).toContain("1,000");
    expect(html).toContain("5.00");
  });
});
