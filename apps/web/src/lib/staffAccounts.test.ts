import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REASON_REQUIRED_ERROR,
  freezeAccount,
  reasonError,
  searchAccounts,
  unfreezeAccount,
} from "./staffAccounts";

const account = { id: "a1", number: "ACC-0001", frozen: true };
const respond = (status: number, body: unknown) =>
  vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("reasonError", () => {
  it("AC1: refuses a blank reason, naming that nothing was frozen", () => {
    expect(reasonError("   ")).toBe(REASON_REQUIRED_ERROR);
    expect(reasonError("")).toContain("The account has not been frozen.");
  });

  it("accepts a reason", () => {
    expect(reasonError("Suspected card fraud")).toBeNull();
  });
});

describe("freezeAccount", () => {
  it("AC2: posts the reason with the staff cookie and returns the frozen account", async () => {
    const fetchMock = respond(201, account);
    vi.stubGlobal("fetch", fetchMock);
    expect(await freezeAccount("a1", "Fraud")).toEqual({ ok: true, account });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff/accounts/a1/freeze",
      expect.objectContaining({ method: "POST", credentials: "include", body: '{"reason":"Fraud"}' }),
    );
  });

  it("AC1: reports the API's reason_required refusal", async () => {
    vi.stubGlobal("fetch", respond(400, { code: "reason_required" }));
    expect(await freezeAccount("a1", " ")).toMatchObject({ ok: false, kind: "reason_required" });
  });

  it("reports a network failure as a generic error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await freezeAccount("a1", "x")).toMatchObject({ ok: false, kind: "error" });
  });
});

describe("unfreezeAccount", () => {
  it("AC3: posts to unfreeze and returns the account", async () => {
    const fetchMock = respond(201, { ...account, frozen: false });
    vi.stubGlobal("fetch", fetchMock);
    expect(await unfreezeAccount("a1")).toMatchObject({ ok: true, account: { frozen: false } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/staff/accounts/a1/unfreeze");
  });
});

describe("searchAccounts", () => {
  it("encodes the query and rejects when the list cannot load", async () => {
    const fetchMock = respond(500, {});
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchAccounts("a b")).rejects.toThrow();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/staff/accounts?q=a%20b");
  });
});
