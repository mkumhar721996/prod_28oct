"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateSignInEmailRequired, validateSignInPasswordRequired } from "@/lib/credentials";
import { signInPlayer, type AuthResult } from "@/lib/session";
import { REGISTER_HREF, WALLET_HREF } from "@/lib/shell";
import { Icon } from "./orders/Icon";

type SignInDeps = {
  signInPlayer: (email: string, password: string) => Promise<AuthResult>;
  replace: (href: string) => void;
  refresh: () => void;
};

export const SIGN_IN_FAILED_ERROR = "Email or password is incorrect";
const UNAUTHORIZED = 401;

/** Field errors are for the required checks; `alert` is the form-level sign-in failure. */
export type SignInErrors = { email?: string; password?: string; alert?: string };

/** Returns what to show; an empty object means we signed in and moved to `redirectTo`. */
export async function handleSignIn(
  deps: SignInDeps,
  email: string,
  password: string,
  redirectTo: string = WALLET_HREF,
  refusalMessage?: string,
): Promise<SignInErrors> {
  const emailError = validateSignInEmailRequired(email);
  if (emailError) return { email: emailError };
  const passwordError = validateSignInPasswordRequired(password);
  if (passwordError) return { password: passwordError };
  const result = await deps.signInPlayer(email, password);
  if (!result.ok) {
    // A fixed refusal message hides the cause (wrong password, customer credentials, unknown email).
    if (refusalMessage) return { alert: refusalMessage };
    // One message for an unknown email and a wrong password, so neither is revealed.
    return { alert: result.status === UNAUTHORIZED ? SIGN_IN_FAILED_ERROR : result.message };
  }
  deps.replace(redirectTo);
  deps.refresh();
  return {};
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
  const [errors, setErrors] = useState<SignInErrors>({});
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const fieldError = refusalMessage !== undefined;

  useEffect(() => {
    if (errors.alert) {
      if (fieldError) passwordRef.current?.focus();
      else alertRef.current?.focus();
    } else if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
  }, [errors, fieldError]);

  const invalid = fieldError && !!errors.alert;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setPending(true);
    const result = await handleSignIn(
      { signInPlayer: signIn, replace: router.replace, refresh: router.refresh },
      email,
      password,
      redirectTo,
      refusalMessage,
    );
    setPending(false);
    setErrors(result);
    // After a failed sign-in keep the email, clear only the password; a required-field error keeps both.
    if (result.alert) setPassword("");
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
            className={errors.email || invalid ? "input is-invalid" : "input"}
            id="si-email"
            type="email"
            autoComplete={fieldError ? "username" : "email"}
            placeholder={fieldError ? "Staff email" : "Email address"}
            ref={emailRef}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email || invalid ? true : undefined}
            aria-describedby={errors.email ? "si-email-err" : invalid ? "si-err" : undefined}
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
            className={errors.password || invalid ? "input is-invalid" : "input"}
            id="si-pass"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            ref={passwordRef}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password || invalid ? true : undefined}
            aria-describedby={errors.password ? "si-pass-err" : invalid ? "si-err" : undefined}
          />
          {errors.password && (
            <span className="field-error" id="si-pass-err">
              {errors.password}
            </span>
          )}
        </div>
        {errors.alert && fieldError && (
          <p className="field-error row-inline" id="si-err" role="alert">
            <Icon name="alert" />
            <span>{errors.alert}</span>
          </p>
        )}
        {errors.alert && !fieldError && (
          <div className="alert alert-danger" role="alert" tabIndex={-1} ref={alertRef}>
            <span>{errors.alert}</span>
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
