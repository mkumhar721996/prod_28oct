"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { sendInvite } from "@/lib/hires/client";
import { ROLES, validateHire, type HireErrors, type HireInput } from "@/lib/hires/validate";

const DASHBOARD = "/hr";
const BLANK: HireInput = { name: "", email: "", role: "", startDate: "" };

type FieldId = keyof HireInput;

/** `from` is accepted only when it is the dashboard, so Cancel can never redirect off-site. */
function safeFrom(from: string | null): string {
  return from === DASHBOARD ? from : DASHBOARD;
}

function summary(count: number): string {
  return count === 1
    ? "Fix 1 field before sending the invite."
    : `Fix ${count} fields before sending the invite.`;
}

export function AddHireForm() {
  const router = useRouter();
  const back = safeFrom(useSearchParams().get("from"));
  const [values, setValues] = useState<HireInput>(BLANK);
  const [errors, setErrors] = useState<HireErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [focusSummary, setFocusSummary] = useState(0);

  useEffect(() => nameRef.current?.focus(), []);
  useEffect(() => {
    if (focusSummary) summaryRef.current?.focus();
  }, [focusSummary]);

  const set = (id: FieldId) => (value: string) => setValues((v) => ({ ...v, [id]: value }));

  function fail(next: HireErrors, message: string | null) {
    setErrors(next);
    setFormError(message);
    setFocusSummary((n) => n + 1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setErrors({});
    setFormError(null);
    const found = validateHire(values);
    if (Object.keys(found).length) return fail(found, null);

    inFlight.current = true;
    setSending(true);
    const input = { ...values, name: values.name.trim(), email: values.email.trim() };
    const result = await sendInvite(input);
    if (result.ok) {
      router.push(`${DASHBOARD}?invited=${encodeURIComponent(input.email)}`);
      return;
    }
    inFlight.current = false;
    setSending(false);
    fail(result.errors, result.formError ?? null);
  }

  const count = Object.keys(errors).length;
  const showSummary = count > 0 || formError !== null;
  const fieldProps = (id: FieldId) => ({
    id: `f-${id}`,
    className: errors[id] ? "input is-invalid" : "input",
    "aria-invalid": errors[id] ? (true as const) : undefined,
    value: values[id],
    onChange: (e: { target: { value: string } }) => set(id)(e.target.value),
  });
  const error = (id: FieldId) => (
    <p className="field-error" id={`e-${id}`} hidden={!errors[id]}>
      {errors[id]}
    </p>
  );

  return (
    <div className="page stack stack-4">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href={back}>New hires</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Add new hire</span>
      </nav>
      <h1>Add new hire</h1>
      <form className="stack stack-4" id="hire-form" noValidate onSubmit={onSubmit}>
        <div className="alert alert-danger" role="alert" tabIndex={-1} ref={summaryRef} hidden={!showSummary}>
          <Icon name="alert" />
          <span>{count > 0 ? summary(count) : formError}</span>
        </div>

        <div className="field">
          <label htmlFor="f-name">Full name</label>
          <input
            {...fieldProps("name")}
            ref={nameRef}
            type="text"
            autoComplete="off"
            placeholder="e.g. Maya Okafor"
            aria-describedby="e-name"
          />
          {error("name")}
        </div>

        <div className="field">
          <label htmlFor="f-email">Work email</label>
          <input
            {...fieldProps("email")}
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
            aria-describedby="h-email e-email"
          />
          <p className="field-hint" id="h-email">
            We&apos;ll send the invite to this address.
          </p>
          {error("email")}
        </div>

        <div className="field">
          <label htmlFor="f-role">Role</label>
          <select {...fieldProps("role")} aria-describedby="e-role">
            <option value="">Choose a role</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {error("role")}
        </div>

        <div className="field">
          <label htmlFor="f-startDate">Start date</label>
          <input {...fieldProps("startDate")} type="date" aria-describedby="e-startDate" />
          {error("startDate")}
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" type="button" onClick={() => router.push(back)}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? "Sending invite…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
