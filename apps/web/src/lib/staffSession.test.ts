import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "staff_session=tok" }) }));
const getSession = vi.fn();
vi.mock("./session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./session")>()),
  getSession: () => getSession(),
}));

import { getStaffAccess, registerStaff, signInStaff, signOutStaff } from "./staffSession";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  getSession.mockReset();
});

describe("getStaffAccess", () => {
  it("is staff for a 200, forwarding the cookie", async () => {
    const fetchMock = stubFetch(200, { email: "a@bank.example" });
    expect(await getStaffAccess()).toEqual({ status: "staff", email: "a@bank.example" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/staff/session"),
      expect.objectContaining({ headers: { cookie: "staff_session=tok" } }),
    );
  });

  it("is refused as signed-out when there is no customer session either", async () => {
    stubFetch(401, { reason: "signed-out" });
    getSession.mockResolvedValue(null);
    expect(await getStaffAccess()).toEqual({ status: "refused", reason: "signed-out" });
  });

  it("is refused as customer when a customer session exists", async () => {
    stubFetch(401, { reason: "signed-out" });
    getSession.mockResolvedValue({ role: "player" });
    expect(await getStaffAccess()).toEqual({ status: "refused", reason: "customer" });
  });

  it("is refused as expired without asking for the customer session", async () => {
    stubFetch(401, { reason: "expired" });
    expect(await getStaffAccess()).toEqual({ status: "refused", reason: "expired" });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("never resolves to staff on another failure", async () => {
    stubFetch(500, {});
    await expect(getStaffAccess()).rejects.toThrow();
    stubFetch(401, {});
    await expect(getStaffAccess()).rejects.toThrow();
  });
});

describe("staff client calls", () => {
  it("signInStaff posts to the staff sign-in", async () => {
    const fetchMock = stubFetch(200, { email: "a@bank.example" });
    expect(await signInStaff("a@bank.example", "Staff-pass1")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/staff/session/sign-in",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("registerStaff reports the refusal", async () => {
    stubFetch(403, { message: "Staff accounts are created by an administrator. No account was created." });
    expect(await registerStaff("x@bank.example", "Whatever-123")).toMatchObject({ ok: false, status: 403 });
  });

  it("signOutStaff rejects on failure", async () => {
    stubFetch(200, {});
    await expect(signOutStaff()).resolves.toBeUndefined();
    stubFetch(500, {});
    await expect(signOutStaff()).rejects.toThrow();
  });
});
