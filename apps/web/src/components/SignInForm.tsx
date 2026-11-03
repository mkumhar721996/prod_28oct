"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signInPlayer, type AuthResult } from "@/lib/session";
import { WALLET_HREF } from "@/lib/shell";
import { Icon } from "./orders/Icon";

/** Shown for any refused sign-in; never says whether the email or the password was wrong. */
export const SIGN_IN_ERROR = "Email or password is incorrect. Check both and try again.";
const UNAUTHORIZED = 401;

type SignInDeps = {
  signInPlayer: (email: string, password: string) => Promise<AuthResult>;
  replace: (href: string) => void;
  refresh: () => void;
};

/** Returns the error to show, or null after a successful sign-in (which navigates to `redirectTo`). */
export async function handleSignIn(
  deps: SignInDeps,
  email: string,
  password: string,
  redirectTo: string = WALLET_HREF,
): Promise<string | null> {
  const result = await deps.signInPlayer(email, password);
  if (!result.ok) return result.status === UNAUTHORIZED ? SIGN_IN_ERROR : result.message;
  deps.replace(redirectTo);
  deps.refresh();
  return null;
}

export function SignInForm({
  email,
  onEmailChange,
  redirectTo = WALLET_HREF,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const message = await handleSignIn(
      { signInPlayer, replace: router.replace, refresh: router.refresh },
      email,
      password,
      redirectTo,
    );
    setPending(false);
    if (message) {
      // Keep the email, clear only the password.
      setPassword("");
      setError(message);
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="si-email">Email</label>
        <input
          className="input"
          id="si-email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="si-pass">Password</label>
        <input
          className="input"
          id="si-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <div className="alert alert-danger" role="alert" tabIndex={-1} ref={alertRef}>
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      )}
      <div className="form-actions stack stack-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
