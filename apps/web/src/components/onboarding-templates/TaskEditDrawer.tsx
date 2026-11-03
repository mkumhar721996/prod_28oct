"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LATEST_DUE_DAY,
  OWNER_OPTIONS,
  parseDays,
  validateTask,
  type Direction,
  type TaskDraft,
  type TaskErrors,
  type TemplateTask,
} from "@/lib/onboardingTemplates";

const FOCUSABLE =
  "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

const DIRECTIONS: readonly { id: Direction; label: string }[] = [
  { id: "before", label: "Before start" },
  { id: "after", label: "After start" },
];

/** The drawer's starting values: the task being edited, or a blank one (due after start by default). */
export function draftFrom(task: TemplateTask | null): TaskDraft {
  return task
    ? { title: task.title, owner: task.owner, direction: task.direction, days: String(task.days) }
    : { title: "", owner: null, direction: "after", days: "" };
}

/** Which control to focus first: the first one with an error, in screen order. */
export function firstInvalid(errors: TaskErrors): "title" | "owner" | "due" | null {
  if (errors.title) return "title";
  if (errors.owner) return "owner";
  if (errors.due) return "due";
  return null;
}

type Props = {
  /** The task being edited; null adds a new one. */
  task: TemplateTask | null;
  roleName: string;
  onDone: (task: TemplateTask) => void;
  onCancel: () => void;
  /** Errors to show on first render (tests). */
  initialErrors?: TaskErrors;
};

/** Add or edit one task. Done validates; Cancel discards the changes. */
export function TaskEditDrawer({ task, roleName, onDone, onCancel, initialErrors }: Props) {
  const [draft, setDraft] = useState<TaskDraft>(() => draftFrom(task));
  const [errors, setErrors] = useState<TaskErrors>(initialErrors ?? {});
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);

  useEffect(() => titleRef.current?.focus(), []);

  useEffect(() => {
    const form = formRef.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !form) return;
      // Keep Tab inside the drawer while it is open.
      const items = Array.from(form.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateTask(draft);
    setErrors(found);
    const first = firstInvalid(found);
    if (first === "title") titleRef.current?.focus();
    else if (first === "owner") formRef.current?.querySelector<HTMLElement>("input[name=owner]")?.focus();
    else if (first === "due") daysRef.current?.focus();
    if (first || draft.owner === null) return;
    onDone({
      title: draft.title.trim(),
      owner: draft.owner,
      direction: draft.direction,
      days: parseDays(draft.days) as number,
    });
  }

  return (
    <>
      <div className="backdrop is-open" data-backdrop="task-drawer" onClick={onCancel} />
      <form
        ref={formRef}
        className="drawer is-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        noValidate
        onSubmit={onSubmit}
      >
        <div className="drawer-header">
          <h2 id="drawer-title">{task ? "Edit task" : "Add task"}</h2>
          <span className="badge badge-neutral">{roleName}</span>
        </div>
        <div className="drawer-body stack stack-4">
          <div className="field">
            <label htmlFor="task-title">Task</label>
            <input
              ref={titleRef}
              className={`input${errors.title ? " is-invalid" : ""}`}
              id="task-title"
              placeholder="Task name"
              autoComplete="off"
              aria-describedby={errors.title ? "title-error" : undefined}
              aria-invalid={errors.title ? true : undefined}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            {errors.title && (
              <p className="field-error" id="title-error" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          <fieldset className="field" aria-describedby={errors.owner ? "owner-error" : undefined}>
            <legend>Owner</legend>
            <div className="radio-line">
              {OWNER_OPTIONS.map((o) => (
                <label key={o.id}>
                  <input
                    type="radio"
                    className={`radio${errors.owner ? " is-invalid" : ""}`}
                    name="owner"
                    value={o.id}
                    checked={draft.owner === o.id}
                    onChange={() => setDraft({ ...draft, owner: o.id })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {errors.owner && (
              <p className="field-error" id="owner-error" role="alert">
                {errors.owner}
              </p>
            )}
          </fieldset>

          <fieldset className="field">
            <legend>Due relative to start date</legend>
            <div className="radio-line">
              {DIRECTIONS.map((d) => (
                <label key={d.id}>
                  <input
                    type="radio"
                    className="radio"
                    name="direction"
                    value={d.id}
                    checked={draft.direction === d.id}
                    onChange={() => setDraft({ ...draft, direction: d.id })}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="task-days">Days</label>
            <input
              ref={daysRef}
              className={`input${errors.due ? " is-invalid" : ""}`}
              id="task-days"
              inputMode="numeric"
              placeholder={`0 to ${LATEST_DUE_DAY}`}
              aria-describedby={errors.due ? "days-hint due-error" : "days-hint"}
              aria-invalid={errors.due ? true : undefined}
              value={draft.days}
              onChange={(e) => setDraft({ ...draft, days: e.target.value })}
            />
            <p className="field-hint" id="days-hint">
              0 is the start date. The latest due date is day {LATEST_DUE_DAY} after start.
            </p>
            {errors.due && (
              <p className="field-error" id="due-error" role="alert">
                {errors.due}
              </p>
            )}
          </div>
        </div>
        <div className="drawer-footer drawer-footer-row">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Done
          </button>
        </div>
      </form>
    </>
  );
}
