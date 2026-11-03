"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { JobRole, TemplateSummary } from "@/lib/onboardingTemplates";
import { NEW_ONBOARDING_TEMPLATE_HREF, ONBOARDING_TEMPLATES_HREF } from "@/lib/shell";

export const CHOOSE_ROLE_ERROR = "Choose a role to continue.";
export const roleExistsError = (name: string) =>
  `A template already exists for ${name}. Edit it from the templates list instead.`;

/** The error for choosing `role`, or null when it may continue. Checks the loaded template list. */
export function roleError(role: string, roles: JobRole[], existing: TemplateSummary[]): string | null {
  if (role === "") return CHOOSE_ROLE_ERROR;
  if (existing.some((t) => t.role === role)) {
    return roleExistsError(roles.find((r) => r.role === role)?.name ?? role);
  }
  return null;
}

export function NewTemplateForm({
  roles,
  existing,
  initialError,
}: {
  roles: JobRole[];
  existing: TemplateSummary[];
  initialError?: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const selectRef = useRef<HTMLSelectElement>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = roleError(role, roles, existing);
    setError(problem);
    if (problem) {
      selectRef.current?.focus();
      return;
    }
    router.push(`${NEW_ONBOARDING_TEMPLATE_HREF}?role=${encodeURIComponent(role)}`);
  }

  return (
    <form className="stack stack-4 narrow" noValidate onSubmit={onSubmit}>
      <h1>New onboarding template</h1>
      <div className="field">
        <label htmlFor="role-select">Role</label>
        <select
          ref={selectRef}
          className={`select${error ? " is-invalid" : ""}`}
          id="role-select"
          aria-describedby="role-error"
          aria-invalid={error ? true : undefined}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setError(null);
          }}
        >
          <option value="">Choose a role</option>
          {roles.map((r) => (
            <option key={r.role} value={r.role}>
              {r.name}
            </option>
          ))}
        </select>
        {error && (
          <p className="field-error" id="role-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="row-end">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push(ONBOARDING_TEMPLATES_HREF)}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Continue
        </button>
      </div>
    </form>
  );
}
