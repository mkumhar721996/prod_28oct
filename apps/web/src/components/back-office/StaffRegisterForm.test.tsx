import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StaffRegisterForm, handleStaffRegister } from "./StaffRegisterForm";

vi.mock("@/lib/staffSession", () => ({ registerStaff: vi.fn() }));

describe("StaffRegisterForm", () => {
  it("AC6: always ends in the administrator refusal, whatever the API says", async () => {
    for (const result of [
      { ok: false as const, status: 403, message: "x" },
      { ok: true as const },
    ]) {
      const deps = { registerStaff: vi.fn(async () => result) };
      expect(await handleStaffRegister(deps, "x@bank.example", "Whatever-123")).toBe(
        "Staff accounts are created by an administrator. No account was created.",
      );
    }
  });

  it("has labelled fields, Create account and a way back to sign in", () => {
    const html = renderToStaticMarkup(<StaffRegisterForm />);
    expect(html).toContain("<h1>Register</h1>");
    expect(html).toContain("Create account");
    expect(html).toContain('href="/back-office/sign-in"');
    expect(html).toContain("Back to sign in");
  });
});
