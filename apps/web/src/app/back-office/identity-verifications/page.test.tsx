import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStaffAccess, getPendingSubmissions, getDecidedSubmissions } = vi.hoisted(() => ({
  getStaffAccess: vi.fn(),
  getPendingSubmissions: vi.fn(async () => [{ id: "1" }]),
  getDecidedSubmissions: vi.fn(async () => []),
}));
vi.mock("@/lib/staffSession", () => ({ getStaffAccess }));
vi.mock("@/lib/identityVerifications", () => ({ getPendingSubmissions, getDecidedSubmissions }));

import { AccessRefused } from "@/components/back-office/AccessRefused";
import { VerificationsScreen } from "@/components/identity-verifications/VerificationsScreen";
import IdentityVerificationsPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("IdentityVerificationsPage", () => {
  it("refuses non-staff without loading any submission", async () => {
    getStaffAccess.mockResolvedValue({ status: "refused", reason: "customer" });
    const el = await IdentityVerificationsPage();
    expect(el.type).toBe(AccessRefused);
    expect(getPendingSubmissions).not.toHaveBeenCalled();
  });

  it("renders both lists for staff", async () => {
    getStaffAccess.mockResolvedValue({ status: "staff", email: "lee.park@example.com" });
    const el = await IdentityVerificationsPage();
    expect(el.type).toBe(VerificationsScreen);
    expect(el.props.initialPending).toEqual([{ id: "1" }]);
  });
});
