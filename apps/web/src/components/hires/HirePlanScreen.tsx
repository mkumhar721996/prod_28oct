"use client";

import Link from "next/link";
import { useState } from "react";
import {
  parseDate,
  refreshPlan,
  saveStartDate,
  START_DATE_ERROR,
  startDateSavedMessage,
  toInputDate,
  type Plan,
} from "@/lib/hires";
import { HIRES_HREF } from "@/lib/shell";
import { Icon } from "../orders/Icon";
import { HirePlanTable } from "./HirePlanTable";

export function HirePlanScreen({ hireId, plan: initial }: { hireId: string; plan: Plan }) {
  const [plan, setPlan] = useState(initial);
  const [text, setText] = useState(toInputDate(initial.startDate));
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function onSave() {
    const iso = parseDate(text);
    setSaved(null);
    setFailed(null);
    setInvalid(iso === null);
    if (iso === null) return;
    setSaving(true);
    const result = await saveStartDate(hireId, iso);
    setSaving(false);
    if (!result.ok) return setFailed(result.message);
    // The API derives every due date from the start date, so ask it for the moved plan.
    const moved = await refreshPlan(hireId);
    if (moved === null) return setFailed("We saved the date but couldn't refresh the plan. Reload the page.");
    setPlan(moved);
    setText(toInputDate(iso));
    setSaved(startDateSavedMessage(iso));
  }

  const total = plan.tasks.length;
  return (
    <div className="stack stack-4">
      <ol className="crumbs" aria-label="Breadcrumb">
        <li>Hires</li>
        <li>{plan.hireName}</li>
        <li aria-current="page">Plan</li>
      </ol>
      <h1>{plan.hireName}’s plan</h1>
      <div>
        <Link className="btn btn-ghost" href={`${HIRES_HREF}/${hireId}`}>
          <Icon name="arrow-left" />
          Back to hire record
        </Link>
      </div>
      <div className="alert alert-info" role="note">
        <Icon name="info" />
        <span>
          This plan is its own copy of the {plan.roleName} template. Later template edits do not change it.
        </span>
      </div>
      <div className="row-between">
        <div className="field">
          <label htmlFor="plan-start">Start date</label>
          <input
            className={`input${invalid ? " is-invalid" : ""}`}
            id="plan-start"
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            aria-describedby="plan-start-error"
            aria-invalid={invalid ? true : undefined}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {invalid && (
            <p className="field-error" id="plan-start-error" role="alert">
              {START_DATE_ERROR}
            </p>
          )}
        </div>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save start date"}
        </button>
      </div>
      {saved && (
        <div className="alert alert-success" role="status">
          <Icon name="check" />
          <span>{saved}</span>
        </div>
      )}
      {failed && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <span>{failed}</span>
        </div>
      )}
      <HirePlanTable hireName={plan.hireName} tasks={plan.tasks} moved={saved !== null} />
      <div
        className="card progress-tile"
        role="img"
        aria-label={`Done: ${plan.doneCount} of ${total} tasks`}
      >
        <span className="text-muted">Done</span>
        <strong>
          {plan.doneCount} of {total}
        </strong>
      </div>
    </div>
  );
}
