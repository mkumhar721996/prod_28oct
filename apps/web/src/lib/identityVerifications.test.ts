import { afterEach, describe, expect, it, vi } from "vitest";
import { approveSubmission, rejectSubmission, submitVerification } from "./identityVerifications";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "" }) }));

const respond = (status: number, body: object = {}) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

afterEach(() => vi.unstubAllGlobals());

describe("identity verification actions", () => {
  it("approves through the rewritten staff path", async () => {
    respond(200, {});
    await expect(approveSubmission("7")).resolves.toEqual({ ok: true });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/staff/identity-verifications/7/approve");
  });

  it("sends the reason when rejecting", async () => {
    respond(200, {});
    await rejectSubmission("7", "Bad ID");
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toEqual({ reason: "Bad ID" });
  });

  it("surfaces a 409 as already-decided with the API message", async () => {
    respond(409, { message: "Already decided." });
    await expect(approveSubmission("7")).resolves.toEqual({
      ok: false,
      reason: "already-decided",
      message: "Already decided.",
    });
  });

  it("surfaces a 400 as invalid", async () => {
    respond(400, { message: "Enter a reason." });
    await expect(rejectSubmission("7", "")).resolves.toMatchObject({ ok: false, reason: "invalid" });
  });

  it("never throws when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(approveSubmission("7")).resolves.toMatchObject({ ok: false, reason: "failed" });
    await expect(
      submitVerification({ fullName: "A", dateOfBirth: "1988-03-14", idNumber: "X" }),
    ).resolves.toMatchObject({ ok: false, reason: "failed" });
  });
});
