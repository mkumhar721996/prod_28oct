import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "session=tok" }) }));

import { BETS, canCover, formatAmount, formatCents, getGame, resultMessage, spinOnce } from "./game";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("presentation helpers", () => {
  it("offers the five bets", () => {
    expect([...BETS]).toEqual([10, 25, 50, 100, 250]);
  });

  it("AC3: a win message names the win and the paytable line", () => {
    expect(resultMessage({ bet: 100, winCredits: 100, label: "Two cherries pay 1× your bet." })).toEqual({
      tone: "success",
      text: "You win 100. Two cherries pay 1× your bet.",
    });
  });

  it("AC4: a loss message names the bet", () => {
    expect(resultMessage({ bet: 100, winCredits: 0, label: null })).toEqual({
      tone: "info",
      text: "No win this time. You bet 100. Try again.",
    });
  });

  it("AC11: formats cents to two places", () => {
    expect(formatCents(38)).toBe("0.38");
    expect(formatCents(13)).toBe("0.13");
    expect(formatCents(200000)).toBe("2,000.00");
  });

  it("formats whole credits with separators", () => {
    expect(formatAmount(1000)).toBe("1,000");
  });

  it("AC9: a balance equal to the bet covers it, one below does not", () => {
    expect(canCover(100, 100)).toBe(true);
    expect(canCover(99, 100)).toBe(false);
  });
});

describe("getGame", () => {
  it("reads the state server side with the cookie", async () => {
    const state = { balanceCredits: 1000, jackpot: { totalCents: 0 } };
    const fetchMock = stubFetch(200, state);
    expect(await getGame()).toEqual(state);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/game$/),
      expect.objectContaining({ cache: "no-store", headers: { cookie: "session=tok" } }),
    );
  });

  it("throws when the API fails", async () => {
    stubFetch(500, {});
    await expect(getGame()).rejects.toThrow("Game lookup failed (500)");
  });
});

describe("spinOnce", () => {
  const settled = {
    reels: ["cherry", "cherry", "bar"],
    bet: 100,
    winCredits: 100,
    label: "Two cherries pay 1× your bet.",
    balanceCredits: 1000,
    jackpot: { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 },
  };

  it("posts the bet and returns the settled spin", async () => {
    const fetchMock = stubFetch(200, settled);
    expect(await spinOnce(100)).toEqual({ ok: true, ...settled });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/spin",
      expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify({ bet: 100 }) }),
    );
  });

  it("AC10: reports an insufficient balance with the server's message and balance", async () => {
    stubFetch(409, { message: "Your balance of 100 does not cover a bet of 250. Choose a lower bet.", balanceCredits: 100 });
    expect(await spinOnce(250)).toEqual({
      ok: false,
      kind: "insufficient",
      message: "Your balance of 100 does not cover a bet of 250. Choose a lower bet.",
      balanceCredits: 100,
    });
  });

  it("never throws: a server error or a network failure is 'failed'", async () => {
    stubFetch(500, {});
    expect(await spinOnce(100)).toEqual({ ok: false, kind: "failed" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await spinOnce(100)).toEqual({ ok: false, kind: "failed" });
  });
});
