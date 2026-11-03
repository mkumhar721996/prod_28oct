import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RegisterForm, handleRegister, DUPLICATE_EMAIL_ERROR } from "./RegisterForm";
import { SignInForm, handleSignIn } from "./SignInForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const nav = () => ({ replace: vi.fn(), refresh: vi.fn() });

describe("handleSignIn", () => {
  it("goes to the wallet and refreshes on success", async () => {
    const deps = { ...nav(), signInPlayer: vi.fn(async () => ({ ok: true as const })) };
    expect(await handleSignIn(deps, "a@b.co", "play-2026")).toBeNull();
    expect(deps.replace).toHaveBeenCalledWith("/wallet");
    expect(deps.refresh).toHaveBeenCalled();
  });

  it("returns the message and stays put on a wrong password", async () => {
    const deps = {
      ...nav(),
      signInPlayer: vi.fn(async () => ({
        ok: false as const,
        status: 401,
        message: "Email or password incorrect",
      })),
    };
    expect(await handleSignIn(deps, "a@b.co", "nope-nope")).toBe("Email or password incorrect");
    expect(deps.replace).not.toHaveBeenCalled();
  });
});

describe("handleRegister", () => {
  it("validates each field before calling the API", async () => {
    const deps = { ...nav(), registerPlayer: vi.fn() };
    expect(await handleRegister(deps, "  ", "a@b.co", "play-2026")).toEqual({
      name: "Enter your name",
    });
    expect(await handleRegister(deps, "x".repeat(51), "a@b.co", "play-2026")).toEqual({
      name: "Use 50 characters or fewer",
    });
    expect(await handleRegister(deps, "Ana", "player-at-example", "play-2026")).toEqual({
      email: "Enter an email like name@example.com",
    });
    expect(await handleRegister(deps, "Ana", "a@b.co", "1234567")).toEqual({
      password: "Use at least 8 characters",
    });
    expect(deps.registerPlayer).not.toHaveBeenCalled();
  });

  it("returns every failing field at once and stays put", async () => {
    const deps = { ...nav(), registerPlayer: vi.fn() };
    expect(await handleRegister(deps, "", "nope", "short")).toEqual({
      name: "Enter your name",
      email: "Enter an email like name@example.com",
      password: "Use at least 8 characters",
    });
    expect(deps.replace).not.toHaveBeenCalled();
    expect(deps.registerPlayer).not.toHaveBeenCalled();
  });

  it("lands on the lobby on success, with a 50-character name", async () => {
    const deps = { ...nav(), registerPlayer: vi.fn(async () => ({ ok: true as const })) };
    expect(await handleRegister(deps, "x".repeat(50), "a@b.co", "exactly8")).toEqual({});
    expect(deps.registerPlayer).toHaveBeenCalledWith("x".repeat(50), "a@b.co", "exactly8");
    expect(deps.replace).toHaveBeenCalledWith("/lobby");
    expect(deps.refresh).toHaveBeenCalled();
  });

  it("shows a server field error beside its field and other failures as an alert", async () => {
    const field = {
      ...nav(),
      registerPlayer: vi.fn(async () => ({
        ok: false as const,
        status: 400,
        message: "Enter your name",
        field: "name",
      })),
    };
    expect(await handleRegister(field, "Ana", "a@b.co", "play-2026")).toEqual({
      name: "Enter your name",
    });
    const down = {
      ...nav(),
      registerPlayer: vi.fn(async () => ({ ok: false as const, status: 500, message: "Oops" })),
    };
    expect(await handleRegister(down, "Ana", "a@b.co", "play-2026")).toEqual({ alert: "Oops" });
    expect(down.replace).not.toHaveBeenCalled();
  });

  it("AC9: shows the duplicate-email field error on 409", async () => {
    const deps = {
      ...nav(),
      registerPlayer: vi.fn(async () => ({ ok: false as const, status: 409, message: "x" })),
    };
    expect(await handleRegister(deps, "Ana", "a@b.co", "play-2026")).toEqual({
      email: DUPLICATE_EMAIL_ERROR,
    });
    expect(DUPLICATE_EMAIL_ERROR).toBe(
      "An account with this email already exists. Sign in instead, or use a different email.",
    );
    expect(deps.replace).not.toHaveBeenCalled();
  });
});

describe("form markup", () => {
  it("sign-in has labelled fields, a primary button and a link to register", () => {
    const html = renderToStaticMarkup(<SignInForm redirected />);
    expect(html).toContain('for="si-email"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain("btn btn-primary");
    expect(html).toContain('href="/register"');
    expect(html).toContain("Sign in to see your wallet.");
  });

  it("register shows the grant note and the password hint", () => {
    const html = renderToStaticMarkup(<RegisterForm />);
    expect(html).toContain("New accounts start with 1,000 credits.");
    expect(html).toContain("At least 8 characters.");
    expect(html).toContain('for="rg-name"');
    expect(html).toContain('autoComplete="name"');
    expect(html).not.toContain("maxLength");
    expect(html).toContain("Create an account");
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("Already have an account? Sign in");
  });
});
