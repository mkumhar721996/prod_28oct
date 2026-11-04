import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, getMyVerification, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMyVerification: vi.fn(async () => ({ status: "pending" })),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/identityVerifications", () => ({ getMyVerification }));
vi.mock("next/navigation", () => ({ redirect }));

import { VerificationStatusScreen } from "@/components/identity-verifications/VerificationStatusScreen";
import IdentityVerificationPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("IdentityVerificationPage", () => {
  it("sends a signed-out visitor to sign-in without loading anything", async () => {
    getSession.mockResolvedValue(null);
    await expect(IdentityVerificationPage()).rejects.toThrow("redirect:/sign-in?next=identity-verification");
    expect(getMyVerification).not.toHaveBeenCalled();
  });

  it("renders the status screen for a signed-in customer", async () => {
    getSession.mockResolvedValue({ role: "player" });
    const el = await IdentityVerificationPage();
    expect(el.type).toBe(VerificationStatusScreen);
    expect(el.props.initial).toEqual({ status: "pending" });
  });
});
