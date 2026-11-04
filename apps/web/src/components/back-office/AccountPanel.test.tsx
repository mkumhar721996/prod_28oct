import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { StaffAccount } from "@/lib/staffAccounts";
import { AccountPanel } from "./AccountPanel";

const active: StaffAccount = {
  id: "a1",
  number: "ACC-4031",
  customerEmail: "amara@example.com",
  balanceCredits: 100,
  frozen: false,
  frozenAt: null,
  frozenBy: null,
  freezeReason: null,
};
const frozen: StaffAccount = {
  ...active,
  number: "ACC-2218",
  frozen: true,
  frozenAt: "2026-11-04T10:00:00Z",
  frozenBy: "j.reyes@bank.example",
  freezeReason: "Suspected card fraud, under review",
};
const handlers = {
  onReasonChange: vi.fn(),
  onFreeze: vi.fn(),
  onUnfreeze: vi.fn(),
  onBackToForm: vi.fn(),
};
const render = (props: Partial<Parameters<typeof AccountPanel>[0]> & { account: StaffAccount }) =>
  renderToStaticMarkup(
    <AccountPanel view="current" reason="" reasonError={null} busy={false} {...handlers} {...props} />,
  );

describe("AccountPanel", () => {
  it("AC2: an active account shows the freeze form with one primary action", () => {
    const html = render({ account: active });
    expect(html).toContain("Reason for freeze (required)");
    expect(html).toContain("badge badge-success");
    expect(html.match(/btn btn-primary/g)).toHaveLength(1);
    expect(html).toContain("Freeze account");
    expect(html).not.toContain("is-invalid");
  });

  it("AC1: a blank-reason error marks the textarea invalid and is announced", () => {
    const html = render({
      account: active,
      reasonError: "Enter a reason to freeze this account. The account has not been frozen.",
    });
    expect(html).toContain("textarea is-invalid");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="reason-error-message"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Enter a reason to freeze this account. The account has not been frozen.");
  });

  it("AC3: a frozen account shows its reason, who and when, and offers Unfreeze account", () => {
    const html = render({ account: frozen });
    expect(html).toContain("badge badge-danger");
    expect(html).toContain("Suspected card fraud, under review");
    expect(html).toContain("j.reyes@bank.example");
    expect(html).toContain("4 Nov 2026");
    expect(html).toContain("Unfreeze account");
    expect(html).not.toContain("Reason for freeze");
  });

  it("confirms an unfreeze in a status alert and offers the way back to the form", () => {
    const html = render({ account: { ...frozen, frozen: false }, view: "unfrozen" });
    expect(html).toContain("alert alert-success");
    expect(html).toContain("Account ACC-2218 is unfrozen. Transfers are allowed again.");
    expect(html).toContain("Back to freeze form");
  });
});
