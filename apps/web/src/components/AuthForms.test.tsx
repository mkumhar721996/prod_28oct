import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EMAIL_IN_USE_ERROR, handleRegister } from "./RegisterForm";
import { SIGN_IN_ERROR, handleSignIn } from "./SignInForm";
import { PASSWORD_ERROR, EMAIL_ERROR } from "@/lib/credentials";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const nav = () => ({ replace: vi.fn(), refresh: vi.fn() });
const refused = (status: number, message: string) => ({
  ...nav(),
  signInPlayer: vi.fn(async () => ({ ok: false as const, status, message })),
});

describe("handleSignIn", () => {
  it("AC2/AC3: goes to the redirect target and refreshes on success", async () => {
    const deps = { ...nav(), signInPlayer: vi.fn(async () => ({ ok: true as const })) };
    expect(await handleSignIn(deps, "a@b.co", "play-2026", "/orders")).toBeNull();
    expect(deps.replace).toHaveBeenCalledWith("/orders");
    expect(deps.refresh).toHaveBeenCalled();
  });

  it("AC5: shows one fixed message whatever the API says about a 401", async () => {
    expect(await handleSignIn(refused(401, "No such email"), "a@b.co", "x")).toBe(SIGN_IN_ERROR);
    expect(await handleSignIn(refused(401, "Wrong password"), "a@b.co", "x")).toBe(SIGN_IN_ERROR);
    expect(SIGN_IN_ERROR).not.toMatch(/\b(email|password) (is )?(wrong|unknown|not found)/i);
    const deps = refused(401, "x");
    await handleSignIn(deps, "a@b.co", "x");
    expect(deps.replace).not.toHaveBeenCalled();
  });

  it("AC5: keeps its own message for other failures", async () => {
    expect(await handleSignIn(refused(429, "Too many attempts"), "a@b.co", "x")).toBe(
      "Too many attempts",
    );
  });

  it("does not validate the email format, so unusual invited addresses can sign in", async () => {
    const deps = { ...nav(), signInPlayer: vi.fn(async () => ({ ok: true as const })) };
    expect(await handleSignIn(deps, "odd@host", "play-2026")).toBeNull();
    expect(deps.signInPlayer).toHaveBeenCalled();
  });
});

describe("handleRegister", () => {
  it("AC8/AC10: validates before calling the API", async () => {
    const deps = { ...nav(), registerPlayer: vi.fn() };
    expect(await handleRegister(deps, "a@@b.co", "play-2026")).toEqual({ email: EMAIL_ERROR });
    expect(await handleRegister(deps, "a@b.co", "abc1234")).toEqual({ password: PASSWORD_ERROR });
    expect(deps.registerPlayer).not.toHaveBeenCalled();
  });

  it("AC1/AC9: signs in straight away on success, even with 8 characters", async () => {
    const deps = { ...nav(), registerPlayer: vi.fn(async () => ({ ok: true as const })) };
    expect(await handleRegister(deps, "new@example.com", "abcd1234")).toEqual({});
    expect(deps.replace).toHaveBeenCalledWith("/wallet?welcome=1");
    expect(deps.refresh).toHaveBeenCalled();
  });

  it("AC4: reports an email in use on 409", async () => {
    const deps = {
      ...nav(),
      registerPlayer: vi.fn(async () => ({ ok: false as const, status: 409, message: "x" })),
    };
    expect(await handleRegister(deps, "taken@example.com", "play-2026")).toEqual({ inUse: true });
    expect(EMAIL_IN_USE_ERROR).toBe("This email is already in use.");
    expect(deps.replace).not.toHaveBeenCalled();
  });

  it("shows other failures as an alert message", async () => {
    const deps = {
      ...nav(),
      registerPlayer: vi.fn(async () => ({ ok: false as const, status: 500, message: "Boom" })),
    };
    expect(await handleRegister(deps, "a@b.co", "play-2026")).toEqual({ alert: "Boom" });
  });
});

describe("RegisterForm markup", () => {
  it("has the password hint and no sign-in link until the email is in use", async () => {
    const { RegisterForm } = await import("./RegisterForm");
    const html = renderToStaticMarkup(
      <RegisterForm email="" onEmailChange={() => {}} onSignInInstead={() => {}} />,
    );
    expect(html).toContain("Use at least 8 characters.");
    expect(html).not.toContain("Sign in instead");
    expect(html).not.toContain("1,000 credits");
  });
});
