"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createTemplate,
  sortTasks,
  updateTemplate,
  type TemplateTask,
} from "@/lib/onboardingTemplates";
import { ONBOARDING_TEMPLATES_HREF } from "@/lib/shell";
import { Icon } from "../orders/Icon";
import { TaskEditDrawer } from "./TaskEditDrawer";
import { TemplateTaskRow } from "./TemplateTaskRow";

export const NO_TASKS_ERROR = "Add at least one task before saving.";

export const plansNote = (planCount: number) =>
  `Plans already created from this template keep their tasks, owners and due dates. Your changes apply to hires added after you save (${planCount} ${planCount === 1 ? "plan" : "plans"} unchanged).`;

/** Which task the open drawer works on: an index into the task list, or a new task. */
export type DrawerTarget = number | "new" | null;

type Props = {
  role: string;
  name: string;
  /** How many hire plans were created from this template. */
  planCount: number;
  initialTasks: TemplateTask[];
  /** `create` for a role with no template yet; `edit` replaces the saved one. */
  mode: "create" | "edit";
  /** State to show on first render (tests). */
  initial?: { drawer?: DrawerTarget; noTasksError?: boolean; saving?: boolean; error?: string };
};

export function TemplateEditor({ role, name, planCount, initialTasks, mode, initial }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TemplateTask[]>(initialTasks);
  const [drawer, setDrawer] = useState<DrawerTarget>(initial?.drawer ?? null);
  const [noTasksError, setNoTasksError] = useState(initial?.noTasksError ?? false);
  const [saving, setSaving] = useState(initial?.saving ?? false);
  const [error, setError] = useState<string | null>(initial?.error ?? null);
  const noTasksRef = useRef<HTMLDivElement>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  useEffect(() => {
    if (noTasksError) noTasksRef.current?.focus();
  }, [noTasksError]);

  // Tasks are shown, and saved, from the earliest due date to the latest; `index` is the task's
  // place in `tasks`, which is what the drawer edits.
  const rows = sortTasks(tasks.map((task, index) => ({ ...task, index })));

  function onDone(task: TemplateTask) {
    setTasks((current) =>
      drawer === "new" || drawer === null
        ? [...current, task]
        : current.map((t, i) => (i === drawer ? task : t)),
    );
    setNoTasksError(false);
    setDrawer(null);
  }

  async function save() {
    if (saving) return;
    if (tasks.length === 0) {
      setNoTasksError(true);
      noTasksRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    const result = await (mode === "create" ? createTemplate : updateTemplate)(role, sortTasks(tasks));
    if (result.ok) {
      router.push(`${ONBOARDING_TEMPLATES_HREF}?saved=${encodeURIComponent(role)}`);
      return;
    }
    setSaving(false);
    setError(result.message);
  }

  return (
    <div className="stack stack-4">
      <h1>{name} template</h1>
      {planCount > 0 && (
        <div className="alert alert-info" role="note">
          <Icon name="info" />
          <span>{plansNote(planCount)}</span>
        </div>
      )}
      {noTasksError && (
        <div className="alert alert-danger" role="alert" tabIndex={-1} ref={noTasksRef}>
          <Icon name="alert" />
          <span>{NO_TASKS_ERROR}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      )}
      {rows.length > 0 ? (
        <ul className="list" aria-label="Template tasks">
          {rows.map(({ index, ...task }) => (
            <TemplateTaskRow key={index} task={task} onEdit={() => setDrawer(index)} />
          ))}
        </ul>
      ) : (
        <p className="text-muted">No tasks yet. Add the first task, from pre-boarding through day 90.</p>
      )}
      <div>
        <button type="button" className="btn btn-secondary" onClick={() => setDrawer("new")}>
          <Icon name="plus" />
          Add task
        </button>
      </div>
      <div className="row-end">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={saving}
          onClick={() => router.push(ONBOARDING_TEMPLATES_HREF)}
        >
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save template"}
        </button>
      </div>
      {drawer !== null && (
        <TaskEditDrawer
          key={drawer}
          task={drawer === "new" ? null : tasks[drawer]}
          roleName={name}
          onDone={onDone}
          onCancel={closeDrawer}
        />
      )}
    </div>
  );
}
