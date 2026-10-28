"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signInPlayer, type AuthResult } from "@/lib/session";
import { REGISTER_HREF, WALLET_HREF } from "@/lib/shell";

type SignInDeps = {
  signInPlayer: (email: string, password: string) => Promise<AuthResult>;
  replace: (href: string) => void;
  refresh: () => void;
};

/** Returns the error to show, or null after a successful sign-in (which navigates to the wallet). */
export async function handleSignIn(
  deps: SignInDeps,
  email: string,
  password: string,
): Promise<string | null> {
  const result = await deps.signInPlayer(email, password);
  if (!result.ok) return result.message;
  deps.replace(WALLET_HREF);
  deps.refresh();
  return null;
}

export function SignInForm({ redirected = false }: { redirected?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
        <h1>Sign in</h1>
        {redirected && (
          <div className="alert alert-info" role="status">
            <span>Sign in to see your wallet.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="si-email">Email</label>
          <input
            className="input"
            id="si-email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="si-pass">Password</label>
          <input
            className="input"
            id="si-pass"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <div className="alert alert-danger" role="alert" tabIndex={-1} ref={alertRef}>
            <span>{error}</span>
          </div>
        )}
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
