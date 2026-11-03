"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateEmail, validateName, validatePassword } from "@/lib/credentials";
import { registerPlayer, type AuthResult } from "@/lib/session";
import { LOBBY_HREF, SIGN_IN_HREF } from "@/lib/shell";

export const DUPLICATE_EMAIL_ERROR =
  "An account with this email already exists. Sign in instead, or use a different email.";
const CONFLICT = 409;

type RegisterDeps = {
  registerPlayer: (name: string, email: string, password: string) => Promise<AuthResult>;
  replace: (href: string) => void;
  refresh: () => void;
};

export type RegisterErrors = { name?: string; email?: string; password?: string; alert?: string };

const FIELDS = ["name", "email", "password"] as const;

/** Returns what to show; an empty object means the account was created and we moved to the lobby. */
export async function handleRegister(
  deps: RegisterDeps,
  name: string,
  email: string,
  password: string,
): Promise<RegisterErrors> {
  const errors: RegisterErrors = {};
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  if (nameError || emailError || passwordError) return errors;
  const result = await deps.registerPlayer(name, email, password);
  if (!result.ok) {
    if (result.status === CONFLICT) return { email: DUPLICATE_EMAIL_ERROR };
    const field = FIELDS.find((f) => f === result.field);
    return field ? { [field]: result.message } : { alert: result.message };
  }
  deps.replace(LOBBY_HREF);
  deps.refresh();
  return {};
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [pending, setPending] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (errors.alert) alertRef.current?.focus();
    else if (errors.name) nameRef.current?.focus();
    else if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
  }, [errors]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setPending(true);
    const result = await handleRegister(
      { registerPlayer, replace: router.replace, refresh: router.refresh },
      name,
      email,
      password,
    );
    setPending(false);
    setErrors(result);
    if (result.alert || result.name || result.email || result.password) setPassword("");
  }

  return (
    <div className="narrow">
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <h1>Create an account</h1>
        <p className="text-muted">New accounts start with 1,000 credits.</p>
        <div className="field">
          <label htmlFor="rg-name">Name</label>
          <input
            className={errors.name ? "input is-invalid" : "input"}
            id="rg-name"
            type="text"
            autoComplete="name"
            placeholder="Name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "rg-name-err" : undefined}
          />
          {errors.name && (
            <span className="field-error" id="rg-name-err">
              {errors.name}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="rg-email">Email</label>
          <input
            className={errors.email ? "input is-invalid" : "input"}
            id="rg-email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            ref={emailRef}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
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
            placeholder="Password"
            ref={passwordRef}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "rg-pass-hint rg-pass-err" : "rg-pass-hint"}
          />
          <span className="field-hint" id="rg-pass-hint">
            At least 8 characters.
          </span>
          {errors.password && (
            <span className="field-error" id="rg-pass-err">
              {errors.password}
            </span>
          )}
        </div>
        {errors.alert && (
          <div className="alert alert-danger" role="alert" tabIndex={-1} ref={alertRef}>
            <span>{errors.alert}</span>
          </div>
        )}
        <div className="form-actions stack stack-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </button>
        </div>
        <p className="text-sm">
          <Link className="link" href={SIGN_IN_HREF}>
            Already have an account? Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
