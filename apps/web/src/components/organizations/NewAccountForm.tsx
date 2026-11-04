"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Toast } from "@/components/appointments/Toast";
import { Icon } from "@/components/orders/Icon";
import { ROLE_LABELS, type CurrentUser, type Role } from "@/lib/orgSession";
import { createAccount, type Account } from "@/lib/organizations";
import { ORGANIZATIONS_HREF, ORG_SIGN_IN_HREF } from "@/lib/shell";
import { roleBadgeClass, SignedInStrip } from "./SignedInStrip";

/** Fixed order; the label is display-only and the id is what the API receives. */
export const ROLE_OPTIONS: readonly { id: Role; label: string }[] = [
  { id: "super_admin", label: ROLE_LABELS.super_admin },
  { id: "staff", label: ROLE_LABELS.staff },
  { id: "fundraising_consultant", label: ROLE_LABELS.fundraising_consultant },
];

type FieldErrors = { email?: string; password?: string; role?: string };
export type CreateOutcome =
  | { kind: "invalid"; errors: FieldErrors }
  | { kind: "ended" }
  | { kind: "failed"; message: string }
  | { kind: "created"; account: Account };

/** Checks the three fields (one role is required), then asks the API to create the account. */
export async function handleCreateAccount(
  deps: { createAccount: typeof createAccount },
  email: string,
  password: string,
  role: Role | null,
): Promise<CreateOutcome> {
  const errors: FieldErrors = {};
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter an email like name@example.com";
  if (password.length < 8) errors.password = "Use at least 8 characters";
  if (role === null) errors.role = "Choose one role";
  if (errors.email || errors.password || role === null) return { kind: "invalid", errors };
  const result = await deps.createAccount({ email: email.trim(), password, role });
  if (result.ok) return { kind: "created", account: result.value };
  if (result.status === 401) return { kind: "ended" };
  return { kind: "failed", message: result.message };
}

export function NewAccountForm({ user, accounts }: { user: CurrentUser; accounts: Account[] }) {
  const router = useRouter();
  const [list, setList] = useState(accounts);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    setPending(true);
    const result = await handleCreateAccount({ createAccount }, email, password, role);
    setPending(false);
    if (result.kind === "ended") return router.replace(`${ORG_SIGN_IN_HREF}?reason=expired`);
    if (result.kind === "invalid") return setErrors(result.errors);
    if (result.kind === "failed") return setFailure(result.message);
    setErrors({});
    setList([...list, result.account]);
    setEmail("");
    setPassword("");
    setRole(null);
    setToast("Account created");
  }

  return (
    <div className="page stack stack-4">
      <SignedInStrip user={user} />
      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
      <div className="row-between">
        <h1>Accounts</h1>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => router.push(ORGANIZATIONS_HREF)}>
          Back to organizations
        </button>
      </div>
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <h2>Create an account</h2>
        {failure && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" />
            <span>{failure}</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="ac-email">Email</label>
          <input
            className={errors.email ? "input is-invalid" : "input"}
            id="ac-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="ac-pass">Password</label>
          <input
            className={errors.password ? "input is-invalid" : "input"}
            id="ac-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
          />
          <span className="field-hint">At least 8 characters.</span>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>
        <fieldset className="field">
          <legend>Role (choose one)</legend>
          <div className="radio-line">
            {ROLE_OPTIONS.map((option) => (
              <label key={option.id}>
                <input
                  className="radio"
                  type="radio"
                  name="role"
                  value={option.id}
                  checked={role === option.id}
                  onChange={() => setRole(option.id)}
                />
                {option.label}
              </label>
            ))}
          </div>
          {errors.role && <span className="field-error">{errors.role}</span>}
        </fieldset>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <section className="card" aria-labelledby="ac-h">
        <h2 id="ac-h">All accounts</h2>
        <ul className="list" aria-live="polite">
          {list.map((account) => (
            <li className="row-between acct" key={account.id}>
              <span>{account.email}</span>
              <span className={roleBadgeClass(account.role)}>{ROLE_LABELS[account.role]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
