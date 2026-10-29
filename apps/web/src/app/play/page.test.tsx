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
vi.mock("@/lib/game", async (orig) => ({ ...(await orig<typeof import("@/lib/game")>()), getGame }));

import PlayPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("PlayPage", () => {
  it("redirects a signed-out visitor to sign-in without loading the game", async () => {
    getSession.mockResolvedValue(null);
    await expect(PlayPage()).rejects.toThrow("redirect:/sign-in?next=play");
    expect(getGame).not.toHaveBeenCalled();
  });

  it("renders the game with the player's balance", async () => {
    getSession.mockResolvedValue({ role: "player", email: "ana@example.com" });
    getGame.mockResolvedValue({
      balanceCredits: 1000,
      jackpot: { miniCents: 0, minorCents: 0, majorCents: 0, grandCents: 0, totalCents: 0 },
    });
    const html = renderToStaticMarkup(await PlayPage());
    expect(html).toContain("Jackpot slots");
    expect(html).toContain("1,000");
    expect(html).toContain(">Spin<");
  });
});
