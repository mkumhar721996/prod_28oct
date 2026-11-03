"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateSignInEmailRequired, validateSignInPasswordRequired } from "@/lib/credentials";
import { signInPlayer, type AuthResult } from "@/lib/session";
import { REGISTER_HREF, WALLET_HREF } from "@/lib/shell";

type SignInDeps = {
  signInPlayer: (email: string, password: string) => Promise<AuthResult>;
  replace: (href: string) => void;
  refresh: () => void;
};

export const SIGN_IN_FAILED_ERROR = "Email or password is incorrect";
const UNAUTHORIZED = 401;

export type SignInErrors = { email?: string; password?: string };

/** Returns what to show; an empty object means we signed in and moved to `redirectTo`. */
export async function handleSignIn(
  deps: SignInDeps,
  email: string,
  password: string,
  redirectTo: string = WALLET_HREF,
): Promise<SignInErrors> {
  const emailError = validateSignInEmailRequired(email);
  if (emailError) return { email: emailError };
  const passwordError = validateSignInPasswordRequired(password);
  if (passwordError) return { password: passwordError };
  const result = await deps.signInPlayer(email, password);
  if (!result.ok) {
    // One message for an unknown email and a wrong password, so neither is revealed.
    return { password: result.status === UNAUTHORIZED ? SIGN_IN_FAILED_ERROR : result.message };
  }
  deps.replace(redirectTo);
  deps.refresh();
  return {};
}

export function SignInForm({
  redirected = false,
  redirectTo = WALLET_HREF,
}: {
  redirected?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<SignInErrors>({});
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
  }, [errors]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setPending(true);
    const result = await handleSignIn(
      { signInPlayer, replace: router.replace, refresh: router.refresh },
      email,
      password,
      redirectTo,
    );
    setPending(false);
    setErrors(result);
    // Keep the email, clear only the password.
    if (result.email || result.password) setPassword("");
  }

  return (
    <div className="narrow">
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <h1>Sign in</h1>
        {redirected && (
          <div className="alert alert-info" role="status">
            <span>Sign in to see your wallet.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="si-email">Email</label>
          <input
            className={errors.email ? "input is-invalid" : "input"}
            id="si-email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            ref={emailRef}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "si-email-err" : undefined}
          />
          {errors.email && (
            <span className="field-error" id="si-email-err">
              {errors.email}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="si-pass">Password</label>
          <input
            className={errors.password ? "input is-invalid" : "input"}
            id="si-pass"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            ref={passwordRef}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "si-pass-err" : undefined}
          />
          {errors.password && (
            <span className="field-error" id="si-pass-err" role="alert">
              {errors.password}
            </span>
          )}
        </div>
        <div className="form-actions stack stack-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <p className="text-sm">
          <Link className="link" href={REGISTER_HREF}>
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
