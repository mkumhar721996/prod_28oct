"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signInPlayer, type AuthResult } from "@/lib/session";
import { REGISTER_HREF, WALLET_HREF } from "@/lib/shell";
import { Icon } from "./orders/Icon";

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
  refusalMessage?: string,
): Promise<string | null> {
  const result = await deps.signInPlayer(email, password);
  // A fixed refusal message hides the cause (wrong password, customer credentials, unknown email).
  if (!result.ok) return refusalMessage ?? result.message;
  deps.replace(redirectTo);
  deps.refresh();
  return null;
}

/** Defaults give the customer sign-in; the staff sign-in overrides them (and gets the field-error style). */
export function SignInForm({
  redirected = false,
  redirectTo = WALLET_HREF,
  title = "Sign in",
  signIn = signInPlayer,
  registerHref = REGISTER_HREF,
  registerPrompt,
  registerLabel = "Create an account",
  refusalMessage,
}: {
  redirected?: boolean;
  redirectTo?: string;
  title?: string;
  signIn?: (email: string, password: string) => Promise<AuthResult>;
  registerHref?: string;
  /** Plain text before the register link, e.g. "No staff account?". */
  registerPrompt?: string;
  registerLabel?: string;
  /** When set, every refusal shows this one message under the fields instead of the server's. */
  refusalMessage?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fieldError = refusalMessage !== undefined;

  useEffect(() => {
    if (!error) return;
    if (fieldError) passwordRef.current?.focus();
    else alertRef.current?.focus();
  }, [error, fieldError]);

  const invalid = fieldError && error !== null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const message = await handleSignIn(
      { signInPlayer: signIn, replace: router.replace, refresh: router.refresh },
      email,
      password,
      redirectTo,
      refusalMessage,
    );
    setPending(false);
    if (message) {
      // Keep the email, clear only the password.
      setPassword("");
      setError(message);
    }
  }

  return (
    <div className="narrow">
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <h1>{title}</h1>
        {redirected && (
          <div className="alert alert-info" role="status">
            <span>Sign in to see your wallet.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="si-email">Email</label>
          <input
            className={invalid ? "input is-invalid" : "input"}
            id="si-email"
            type="email"
            autoComplete={fieldError ? "username" : "email"}
            placeholder={fieldError ? "Staff email" : "Email address"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? "si-err" : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="si-pass">Password</label>
          <input
            className={invalid ? "input is-invalid" : "input"}
            id="si-pass"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            ref={passwordRef}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? "si-err" : undefined}
          />
        </div>
        {error && fieldError && (
          <p className="field-error row-inline" id="si-err" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </p>
        )}
        {error && !fieldError && (
          <div className="alert alert-danger" role="alert" tabIndex={-1} ref={alertRef}>
            <span>{error}</span>
          </div>
        )}
        <div className="form-actions stack stack-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <p className="text-sm row-inline">
          {registerPrompt && <span>{registerPrompt}</span>}
          <Link className="link" href={registerHref}>
            {registerLabel}
          </Link>
        </p>
      </form>
    </div>
  );
}
