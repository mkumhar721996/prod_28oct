"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createPlan,
  parseDate,
  saveManager,
  saveStartDate,
  START_DATE_ERROR,
  toInputDate,
  type Hire,
} from "@/lib/hires";
import { HIRES_HREF } from "@/lib/shell";
import { Toast } from "../appointments/Toast";
import { Icon } from "../orders/Icon";

export const REFUSED_TOAST = "Plan not created";

export function HireRecordScreen({ hire, managers }: { hire: Hire; managers: string[] }) {
  const router = useRouter();
  const [startText, setStartText] = useState(toInputDate(hire.startDate));
  const [manager, setManager] = useState(hire.managerName ?? "");
  const [pending, setPending] = useState(false);
  const [hasPlan, setHasPlan] = useState(hire.planId !== null);
  const [error, setError] = useState<string | null>(null);
  const [startInvalid, setStartInvalid] = useState(false);
  const [managerInvalid, setManagerInvalid] = useState(false);
  const [toast, setToast] = useState(false);

  const planHref = `${HIRES_HREF}/${hire.id}/plan`;

  function refuse(message: string, kind?: string) {
    setError(message);
    setManagerInvalid(kind === "no_manager");
    setToast(true);
  }

  async function onCreate() {
    if (hasPlan) return router.push(planHref);
    setError(null);
    setStartInvalid(false);
    setManagerInvalid(false);
    const iso = parseDate(startText);
    if (iso === null) {
      setStartInvalid(true);
      setError(`Plan not created: ${START_DATE_ERROR.charAt(0).toLowerCase()}${START_DATE_ERROR.slice(1)}`);
      return;
    }
    setPending(true);
    // The record's fields are what the plan is built from, so save any change first.
    if (iso !== hire.startDate) {
      const saved = await saveStartDate(hire.id, iso);
      if (!saved.ok) return fail(saved.message);
    }
    if (manager !== (hire.managerName ?? "")) {
      const saved = await saveManager(hire.id, manager === "" ? null : manager);
      if (!saved.ok) return fail(saved.message);
    }
    const result = await createPlan(hire.id);
    setPending(false);
    if (result.ok || result.kind === "plan_exists") {
      setHasPlan(true);
      router.push(planHref);
      return;
    }
    refuse(result.message, result.kind);
  }

  function fail(message: string) {
    setPending(false);
    refuse(message);
  }

  return (
    <div className="stack stack-4 narrow">
      <ol className="crumbs" aria-label="Breadcrumb">
        <li>Hires</li>
        <li aria-current="page">{hire.name}</li>
      </ol>
      <h1>Hire record</h1>
      <div className="card">
        <div className="stack stack-4">
          <h2>{hire.name}</h2>
          <p>Role: {hire.roleName}</p>
          <div className="field">
            <label htmlFor="start-date">Start date</label>
            <input
              className={`input${startInvalid ? " is-invalid" : ""}`}
              id="start-date"
              placeholder="DD/MM/YYYY"
              inputMode="numeric"
              aria-describedby="start-hint"
              aria-invalid={startInvalid ? true : undefined}
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
            />
            <p className="field-hint" id="start-hint">
              Task due dates are counted from this date.
            </p>
          </div>
          <div className="field">
            <label htmlFor="manager">Manager</label>
            <select
              className={`select${managerInvalid ? " is-invalid" : ""}`}
              id="manager"
              aria-invalid={managerInvalid ? true : undefined}
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">Choose manager</option>
              {managers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="row-between">
        <span className={`badge ${hasPlan ? "badge-success" : "badge-neutral"}`}>
          {hasPlan ? "Plan created" : "No plan yet"}
        </span>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={onCreate}>
          {pending ? "Creating plan…" : hasPlan ? "View plan" : "Create plan"}
        </button>
      </div>
      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      )}
      {toast && <Toast message={REFUSED_TOAST} onHide={() => setToast(false)} />}
    </div>
  );
}
