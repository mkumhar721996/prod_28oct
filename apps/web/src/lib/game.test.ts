import { afterEach, describe, expect, it, vi } from "vitest";
import { BETS, canCover, formatCents, resultMessage, spinOnce } from "./game";

afterEach(() => vi.unstubAllGlobals());

describe("game helpers", () => {
  it("offers the five bets", () => {
    expect([...BETS]).toEqual([10, 25, 50, 100, 250]);
  });

  it("AC3: a win message names the win and the label", () => {
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

  it.each([
    [38, "0.38"],
    [200, "2.00"],
    [150000, "1,500.00"],
  ])("AC11: formats %i cents as %s", (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });

  it("AC9: a balance equal to the bet covers it, one less does not", () => {
    expect(canCover(100, 100)).toBe(true);
    expect(canCover(99, 100)).toBe(false);
  });
});

describe("spinOnce", () => {
  const respond = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

  it("posts the bet and returns the settled spin", async () => {
    respond(200, { reels: ["bar", "bar", "bar"], bet: 100, winCredits: 0, label: null, balanceCredits: 900 });
    const out = await spinOnce(100);
    expect(out).toMatchObject({ ok: true, balanceCredits: 900 });
    expect(fetch).toHaveBeenCalledWith(
      "/api/game/spin",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ bet: 100 }) }),
    );
  });

  it("reports an insufficient balance from a 409", async () => {
    respond(409, { message: "Your balance of 100 does not cover a bet of 250. Choose a lower bet." });
    expect(await spinOnce(250)).toMatchObject({ ok: false, kind: "insufficient" });
  });

  it("reports a failure on other statuses and never throws", async () => {
    respond(500, {});
    expect(await spinOnce(100)).toEqual({ ok: false, kind: "failed", message: undefined });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await spinOnce(100)).toMatchObject({ ok: false, kind: "failed" });
  });
});
