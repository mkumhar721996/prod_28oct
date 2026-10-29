import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ claimFreeCredits: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ClaimCreditsPanel, runClaim } from "./ClaimCreditsPanel";

const render = (balanceCredits: number, eligible: boolean) =>
  renderToStaticMarkup(
    <ClaimCreditsPanel balanceCredits={balanceCredits} topUp={{ eligible, credits: 500 }} />,
  );

describe("ClaimCreditsPanel", () => {
  it("is available, with an enabled button, at a balance of 1", () => {
    const html = render(1, true);
    expect(html).toContain("Free credits</h2>");
    expect(html).toContain('badge-success">Available<');
    expect(html).toContain("Your balance is 1 credit.");
    expect(html).toContain("A claim adds 500 credits.");
    expect(html).toContain("1 credit or less, so you can claim free credits");
    expect(html).toMatch(/<button(?![^>]*disabled="")[^>]*>Claim free credits<\/button>/);
  });

  it("is still shown, with a disabled button, at a balance of 2", () => {
    const html = render(2, false);
    expect(html).toContain('badge-neutral">Not available<');
    expect(html).toContain("Your balance is 2 credits.");
    expect(html).toContain("Free credits are available when your balance is 1 credit or less.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-disabled="true"[^>]*>Claim free credits</);
  });
});

describe("runClaim", () => {
  it("reports success and refreshes once", async () => {
    const refresh = vi.fn();
    const claimFreeCredits = vi.fn(async () => ({
      ok: true as const,
      balanceCredits: 501,
      grantedCredits: 500,
    }));
    expect(await runClaim({ claimFreeCredits, refresh })).toEqual({
      ok: true,
      message: "Free credits claimed: 500 credits. Balance 501 credits.",
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
