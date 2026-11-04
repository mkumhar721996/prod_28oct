import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { handleSignIn } from "@/components/SignInForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/orgSession", () => ({ signInUser: vi.fn() }));

import { OrgSignInForm, ORG_SIGN_IN_REFUSAL, SESSION_ENDED_NOTICE } from "./OrgSignInForm";

describe("OrgSignInForm", () => {
  it("AC2: every refusal shows 'Email or password is incorrect', whatever the server said", async () => {
    const deps = {
      signInPlayer: vi.fn(async () => ({ ok: false as const, status: 401, message: "other" })),
      replace: vi.fn(),
      refresh: vi.fn(),
    };
    expect(ORG_SIGN_IN_REFUSAL).toBe("Email or password is incorrect");
    expect(await handleSignIn(deps, "a@org.example", "wrong-pass-1", "/organizations", ORG_SIGN_IN_REFUSAL)).toBe(
      "Email or password is incorrect",
    );
    expect(deps.replace).not.toHaveBeenCalled();
  });

  it("AC10: a successful sign-in goes to the organizations", async () => {
    const deps = {
      signInPlayer: vi.fn(async () => ({ ok: true as const })),
      replace: vi.fn(),
      refresh: vi.fn(),
    };
    expect(await handleSignIn(deps, "a@org.example", "Welcome-2026", "/organizations", ORG_SIGN_IN_REFUSAL)).toBeNull();
    expect(deps.replace).toHaveBeenCalledWith("/organizations");
  });

  it("offers no way to register an account", () => {
    const html = renderToStaticMarkup(<OrgSignInForm />);
    expect(html).toContain("Sign in");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain(SESSION_ENDED_NOTICE);
  });

  it("AC11: tells a user whose session ended", () => {
    expect(renderToStaticMarkup(<OrgSignInForm sessionEnded />)).toContain(SESSION_ENDED_NOTICE);
  });
});
