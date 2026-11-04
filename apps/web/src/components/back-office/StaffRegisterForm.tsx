"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { STAFF_SIGN_IN_HREF } from "@/lib/shell";
import type { AuthResult } from "@/lib/session";
import { registerStaff } from "@/lib/staffSession";
import { Icon } from "../orders/Icon";

export const STAFF_REGISTER_REFUSAL =
  "Staff accounts are created by an administrator. No account was created.";

type StaffRegisterDeps = {
  registerStaff: (email: string, password: string) => Promise<AuthResult>;
};

/** Always returns the refusal to show: registering never creates an account and never navigates. */
export async function handleStaffRegister(
  deps: StaffRegisterDeps,
  email: string,
  password: string,
): Promise<string> {
  await deps.registerStaff(email, password);
  return STAFF_REGISTER_REFUSAL;
}

export function StaffRegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) passwordRef.current?.focus();
  }, [error]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const message = await handleStaffRegister({ registerStaff }, email, password);
    setPending(false);
    setPassword("");
    setError(message);
  }

  const invalid = error !== null;
  return (
    <div className="narrow">
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <h1>Register</h1>
        <div className="field">
          <label htmlFor="sr-email">Email</label>
          <input
            className={invalid ? "input is-invalid" : "input"}
            id="sr-email"
            type="email"
            autoComplete="username"
            placeholder="Staff email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? "sr-err" : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="sr-pass">Password</label>
          <input
            className={invalid ? "input is-invalid" : "input"}
            id="sr-pass"
            type="password"
            autoComplete="new-password"
            placeholder="Password"
            ref={passwordRef}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? "sr-err" : undefined}
          />
        </div>
        {error && (
          <p className="field-error row-inline" id="sr-err" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </p>
        )}
        <div className="form-actions stack stack-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </button>
        </div>
        <p className="text-sm">
          <Link className="link" href={STAFF_SIGN_IN_HREF}>
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
