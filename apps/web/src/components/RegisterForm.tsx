"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateEmail, validatePassword } from "@/lib/credentials";
import { registerPlayer, type AuthResult } from "@/lib/session";
import { WALLET_HREF } from "@/lib/shell";
import { Icon } from "./orders/Icon";

export const EMAIL_IN_USE_ERROR = "This email is already in use.";
const CONFLICT = 409;

type RegisterDeps = {
  registerPlayer: (email: string, password: string) => Promise<AuthResult>;
  replace: (href: string) => void;
  refresh: () => void;
};

export type RegisterErrors = {
  email?: string;
  password?: string;
  alert?: string;
  inUse?: boolean;
};

/** Returns what to show; an empty object means the account was created and we moved to the wallet. */
export async function handleRegister(
  deps: RegisterDeps,
  email: string,
  password: string,
): Promise<RegisterErrors> {
  const emailError = validateEmail(email);
  if (emailError) return { email: emailError };
  const passwordError = validatePassword(password);
  if (passwordError) return { password: passwordError };
  const result = await deps.registerPlayer(email, password);
  if (!result.ok) {
    if (result.status === CONFLICT) return { inUse: true };
    return { alert: result.message };
  }
  deps.replace(`${WALLET_HREF}?welcome=1`);
  deps.refresh();
  return {};
}

export function RegisterForm({
  email,
  onEmailChange,
  onSignInInstead,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onSignInInstead: () => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [pending, setPending] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (errors.alert || errors.inUse) alertRef.current?.focus();
    else if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
  }, [errors]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setPending(true);
    const result = await handleRegister(
      { registerPlayer, replace: router.replace, refresh: router.refresh },
      email,
      password,
    );
    setPending(false);
    setErrors(result);
    if (result.alert || result.inUse || result.email || result.password) setPassword("");
  }

  const emailInvalid = Boolean(errors.email || errors.inUse);

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="rg-email">Email</label>
        <input
          className={emailInvalid ? "input is-invalid" : "input"}
          id="rg-email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          ref={emailRef}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          aria-invalid={emailInvalid ? true : undefined}
          aria-describedby={errors.email ? "rg-email-err" : undefined}
        />
        {errors.email && (
          <span className="field-error" id="rg-email-err">
            {errors.email}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="rg-pass">Password</label>
        <input
          className={errors.password ? "input is-invalid" : "input"}
          id="rg-pass"
          type="password"
          autoComplete="new-password"
          ref={passwordRef}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "rg-pass-hint rg-pass-err" : "rg-pass-hint"}
        />
        <span className="field-hint" id="rg-pass-hint">
          Use at least 8 characters.
        </span>
        {errors.password && (
          <span className="field-error" id="rg-pass-err">
            {errors.password}
          </span>
        )}
      </div>
      {(errors.alert || errors.inUse) && (
        <div className="alert alert-danger" role="alert" tabIndex={-1} ref={alertRef}>
          <Icon name="alert" />
          <span>{errors.inUse ? EMAIL_IN_USE_ERROR : errors.alert}</span>
          {errors.inUse && (
            <button className="link-btn" type="button" onClick={onSignInInstead}>
              Sign in instead
            </button>
          )}
        </div>
      )}
      <div className="form-actions stack stack-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </div>
    </form>
  );
}
