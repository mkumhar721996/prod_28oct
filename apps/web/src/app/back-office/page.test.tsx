import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffAccess = vi.fn();
vi.mock("@/lib/staffSession", () => ({
  getStaffAccess: () => getStaffAccess(),
  signOutStaff: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import BackOfficePage from "./page";

const render = async () => renderToStaticMarkup(await BackOfficePage());

beforeEach(() => getStaffAccess.mockReset());

describe("back-office page", () => {
  it("AC1: opens the tools for staff", async () => {
    getStaffAccess.mockResolvedValue({ status: "staff", email: "a@bank.example" });
    const html = await render();
    expect(html).toContain("Back-office tools");
    expect(html).toContain("Signed in as staff");
  });

  it("AC4: a signed-out visitor sees no back-office content", async () => {
    getStaffAccess.mockResolvedValue({ status: "refused", reason: "signed-out" });
    const html = await render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("You are signed out, so the back-office page was not shown.");
    expect(html).not.toContain("Back-office tools");
    expect(html).not.toContain("Sign out");
  });

  it("AC2: a signed-in customer is refused", async () => {
    getStaffAccess.mockResolvedValue({ status: "refused", reason: "customer" });
    const html = await render();
    expect(html).toContain("Customer accounts cannot open back-office pages.");
    expect(html).not.toContain("Find an account");
    expect(html).not.toContain("Back-office tools");
  });

  it("AC9: an idle-expired session is refused with its own reason", async () => {
    getStaffAccess.mockResolvedValue({ status: "refused", reason: "expired" });
    expect(await render()).toContain("Your session ended after 15 minutes without activity.");
  });
});
