import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BackOfficeHome, handleStaffSignOut } from "./BackOfficeHome";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/staffSession", () => ({ signOutStaff: vi.fn() }));
vi.mock("@/lib/staffAccounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/staffAccounts")>()),
  searchAccounts: vi.fn(() => new Promise(() => undefined)),
}));

describe("BackOfficeHome", () => {
  it("shows the toolbar sign out, the accounts screen, the placeholder and status badge", () => {
    const html = renderToStaticMarkup(<BackOfficeHome />);
    expect(html).toContain("Find an account");
    expect(html).toContain("btn btn-ghost");
    expect(html).toContain("Sign out");
    expect(html).toContain("Back-office tools");
    expect(html).toContain("badge badge-info");
  });

  it("AC8: signs out, then goes to the staff sign-in", async () => {
    const deps = { signOutStaff: vi.fn(async () => undefined), replace: vi.fn() };
    expect(await handleStaffSignOut(deps)).toBe(true);
    expect(deps.replace).toHaveBeenCalledWith("/back-office/sign-in");
  });

  it("stays put when sign-out fails", async () => {
    const deps = { signOutStaff: vi.fn().mockRejectedValue(new Error("x")), replace: vi.fn() };
    expect(await handleStaffSignOut(deps)).toBe(false);
    expect(deps.replace).not.toHaveBeenCalled();
  });
});
