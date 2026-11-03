import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ claimFreeCredits: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { Toast } from "./appointments/Toast";
import { ClaimCreditsPanel, runClaim } from "./ClaimCreditsPanel";

const render = (balanceCredits: number, eligible: boolean) =>
  renderToStaticMarkup(
    <ClaimCreditsPanel balanceCredits={balanceCredits} topUp={{ eligible, credits: 1000 }} />,
  );

describe("ClaimCreditsPanel", () => {
  it.each([1, 0])("offers an enabled claim at a balance of %i", (balance) => {
    const html = render(balance, true);
    expect(html).toMatch(
      /<button(?![^>]*disabled)[^>]*class="btn btn-primary"[^>]*>Claim free top-up<\/button>/,
    );
    expect(html).toContain("Your balance is too low to bet.");
  });

  it("offers no claim control at a balance of 2", () => {
    const html = render(2, false);
    expect(html).not.toContain("Claim free top-up");
    expect(html).not.toContain("<button");
    expect(html).toContain("You have enough credits to place a bet.");
  });
});

describe("Toast variants", () => {
  it("keeps the default fixed success toast", () => {
    const html = renderToStaticMarkup(<Toast message="Saved" />);
    expect(html).toContain('class="toast is-open"');
    expect(html).toContain('role="status"');
  });

  it("renders an inline error toast as an alert", () => {
    const html = renderToStaticMarkup(<Toast inline tone="error" message="No" />);
    expect(html).toContain("toast is-open is-inline");
    expect(html).toContain('role="alert"');
  });
});

describe("runClaim", () => {
  it("reports success and refreshes once", async () => {
    const refresh = vi.fn();
    const claimFreeCredits = vi.fn(async () => ({
      ok: true as const,
      balanceCredits: 1001,
      grantedCredits: 1000,
    }));
    expect(await runClaim({ claimFreeCredits, refresh })).toEqual({
      ok: true,
      message: "Free top-up added: 1,000 credits",
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("returns the API message and does not refresh when refused", async () => {
    const message = "Free top-up is only available when your balance is 1 credit or less.";
    const refresh = vi.fn();
    const claimFreeCredits = vi.fn(async () => ({ ok: false as const, message }));
    expect(await runClaim({ claimFreeCredits, refresh })).toEqual({ ok: false, message });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to a generic message", async () => {
    const claimFreeCredits = vi.fn(async () => ({ ok: false as const }));
    expect(await runClaim({ claimFreeCredits, refresh: vi.fn() })).toEqual({
      ok: false,
      message: "Couldn't claim free credits. Try again.",
    });
  });
});
