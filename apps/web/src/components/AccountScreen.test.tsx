import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountScreen } from "./AccountScreen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("AccountScreen", () => {
  it("AC6: the sign-in page offers account creation", () => {
    const html = renderToStaticMarkup(<AccountScreen initialMode="sign-in" />);
    expect(html).toContain('role="tab"');
    expect(html).toContain("Create account");
  });

  it("AC7: the same page offers sign-in, selected by default, with its form", () => {
    const html = renderToStaticMarkup(<AccountScreen initialMode="sign-in" />);
    expect(html).toMatch(/aria-selected="true"[^>]*>Sign in</);
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('for="si-email"');
    expect(html).toContain("btn btn-primary");
  });

  it("the register page selects the Create account tab with its form", () => {
    const html = renderToStaticMarkup(<AccountScreen initialMode="register" />);
    expect(html).toMatch(/aria-selected="true"[^>]*>Create account</);
    expect(html).toContain('autoComplete="new-password"');
  });

  it("keeps the wallet notice above the form when redirected", () => {
    const html = renderToStaticMarkup(<AccountScreen initialMode="sign-in" redirected />);
    expect(html).toContain("Sign in to see your wallet.");
  });
});
