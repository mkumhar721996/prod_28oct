"use client";

import { useState, type FormEvent } from "react";
import { submitVerification, type Details, type MyVerification } from "@/lib/identityVerifications";
import { Icon } from "../orders/Icon";

type Errors = Partial<Record<keyof Details, string>>;

const REQUIRED: Record<keyof Details, string> = {
  fullName: "Enter your full name.",
  dateOfBirth: "Enter your date of birth.",
  idNumber: "Enter your ID number.",
};

/** A message per blank field; an empty object means the details can be sent. */
export function validateDetails(details: Details): Errors {
  const errors: Errors = {};
  for (const key of Object.keys(REQUIRED) as (keyof Details)[]) {
    if (details[key].trim() === "") errors[key] = REQUIRED[key];
  }
  return errors;
}

type Props = {
  heading: string;
  initial: Details;
  /** The staff reason for the last rejection, if any. */
  lastReason: string | null;
  onSubmitted: (verification: MyVerification) => void;
  onCancel?: () => void;
};

const FIELDS: { key: keyof Details; label: string; type: string; autoComplete?: string }[] = [
  { key: "fullName", label: "Full name", type: "text", autoComplete: "name" },
  { key: "dateOfBirth", label: "Date of birth", type: "date", autoComplete: "bday" },
  { key: "idNumber", label: "ID number", type: "text" },
];

/** Customer form for ID details; first submit and resubmit after a rejection. */
export function ResubmitForm({ heading, initial, lastReason, onSubmitted, onCancel }: Props) {
  const [values, setValues] = useState<Details>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validateDetails(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const result = await submitVerification(values);
    setBusy(false);
    if (result.ok) onSubmitted(result.verification);
    else setFormError(result.message);
  }

  return (
    <form className="card stack stack-2" noValidate onSubmit={onSubmit}>
      <h2>{heading}</h2>
      {lastReason && (
        <p className="text-muted">
          <strong>Last reason:</strong> {lastReason}
        </p>
      )}
      {formError && (
        <div className="alert alert-danger" role="alert">
          {formError}
        </div>
      )}
      {FIELDS.map(({ key, label, type, autoComplete }) => (
        <div className="field" key={key}>
          <label htmlFor={`idv-${key}`}>{label}</label>
          <input
            className={errors[key] ? "input is-invalid" : "input"}
            id={`idv-${key}`}
            type={type}
            autoComplete={autoComplete}
            value={values[key]}
            aria-invalid={errors[key] ? true : undefined}
            aria-describedby={errors[key] ? `idv-${key}-error` : undefined}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          />
          {errors[key] && (
            <p className="field-error row-inline" id={`idv-${key}-error`} role="alert">
              <Icon name="alert" />
              <span>{errors[key]}</span>
            </p>
          )}
        </div>
      ))}
      <div className="form-actions form-actions-end">
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Submitting…" : "Submit"}
        </button>
      </div>
    </form>
  );
}
