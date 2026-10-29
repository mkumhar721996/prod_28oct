import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "session=tok" }) }));

import {
  claimFreeCredits,
  getWallet,
  getWalletBalance,
  getWalletHistory,
  registerPlayer,
  signInPlayer,
} from "./session";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("registerPlayer / signInPlayer", () => {
  it("posts credentials with the cookie and reports ok", async () => {
    const fetchMock = stubFetch(201, { role: "player" });
    expect(await registerPlayer("a@b.co", "play-2026")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/session/register",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("returns the server message and status on refusal", async () => {
    stubFetch(401, { message: "Email or password incorrect" });
    expect(await signInPlayer("a@b.co", "nope-nope")).toEqual({
      ok: false,
      status: 401,
      message: "Email or password incorrect",
    });
  });

  it("falls back to a generic message when the server gives none", async () => {
    stubFetch(500, {});
    const result = await signInPlayer("a@b.co", "play-2026");
    expect(result.ok).toBe(false);
  });

  it("does not throw when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await signInPlayer("a@b.co", "play-2026")).ok).toBe(false);
  });
});

describe("getWalletBalance", () => {
  it("forwards the cookie and returns the balance", async () => {
    const fetchMock = stubFetch(200, { balanceCredits: 1000 });
    expect(await getWalletBalance()).toBe(1000);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/wallet$/),
      expect.objectContaining({ headers: { cookie: "session=tok" } }),
    );
  });

  it("throws when the wallet cannot be read", async () => {
    stubFetch(500, {});
    await expect(getWalletBalance()).rejects.toThrow();
  });
});

describe("getWallet", () => {
  it("returns the balance and top-up state", async () => {
    const body = { balanceCredits: 1, topUp: { eligible: true, credits: 500 } };
    stubFetch(200, body);
    expect(await getWallet()).toEqual(body);
  });

  it("throws on a non-OK response", async () => {
    stubFetch(500, {});
    await expect(getWallet()).rejects.toThrow();
  });
});

describe("getWalletHistory", () => {
  it("forwards the cookie and asks for the page and range", async () => {
    const fetchMock = stubFetch(200, { entries: [], page: 2, pageCount: 3, total: 24, range: "all" });
    expect((await getWalletHistory(2, "all")).pageCount).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/wallet\/history\?page=2&range=all$/),
      expect.objectContaining({ headers: { cookie: "session=tok" }, cache: "no-store" }),
    );
  });

  it("throws on a non-OK response", async () => {
    stubFetch(500, {});
    await expect(getWalletHistory(1, "recent")).rejects.toThrow();
  });
});

describe("claimFreeCredits", () => {
  it("posts with credentials and returns the new balance", async () => {
    const fetchMock = stubFetch(200, { balanceCredits: 501, grantedCredits: 500 });
    expect(await claimFreeCredits()).toEqual({ ok: true, balanceCredits: 501, grantedCredits: 500 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wallet/top-up",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("returns the server message on a 409", async () => {
    stubFetch(409, { message: "Free top-up is only available when your balance is 1 credit or less." });
    expect(await claimFreeCredits()).toEqual({
      ok: false,
      message: "Free top-up is only available when your balance is 1 credit or less.",
    });
  });

  it("gives no message when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await claimFreeCredits()).toEqual({ ok: false });
  });
});
