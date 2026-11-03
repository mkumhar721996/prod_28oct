// Keep in sync with LATEST_DUE_DAY in services/api/src/onboarding-templates/onboarding-templates.constants.ts and the check in services/api/migrations/004_onboarding_templates.sql (pinned by onboarding-templates.service.spec.ts).
/** The latest due date: day 90 after the start date. Days before the start date are unlimited. */
export const LATEST_DUE_DAY = 90;

export type Owner = "hiring_manager" | "it" | "new_hire" | "hr";
export type Direction = "before" | "after";

export const OWNER_OPTIONS: readonly { id: Owner; label: string }[] = [
  { id: "hiring_manager", label: "Hiring manager" },
  { id: "it", label: "IT" },
  { id: "new_hire", label: "New hire" },
  { id: "hr", label: "HR" },
];

export const ownerLabel = (owner: Owner): string =>
  OWNER_OPTIONS.find((o) => o.id === owner)?.label ?? owner;

/** A saved task. `days` is how far from the start date; `direction` says which side. */
export type TemplateTask = { title: string; owner: Owner; direction: Direction; days: number };
/** A task as typed in the drawer: owner may be unset and days is the raw text. */
export type TaskDraft = { title: string; owner: Owner | null; direction: Direction; days: string };
export type TaskErrors = { title?: string; owner?: string; due?: string };

export type Template = { role: string; name: string; planCount: number; tasks: TemplateTask[] };
export type TemplateSummary = { role: string; name: string; taskCount: number; planCount: number };
export type JobRole = { role: string; name: string };

export type SaveResult =
  | { ok: true }
  | {
      ok: false;
      kind: "role_exists" | "invalid" | "error";
      message: string;
      /** Which task the server refused, when it says. */
      taskIndex?: number;
    };

// The browser calls /api/onboarding-templates on the web origin; next.config.ts rewrites it (cookies
// included) to the API. It is under /api because /onboarding-templates is the page itself.
const TEMPLATES_API_PATH = "/api/onboarding-templates";
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const GENERIC_ERROR = "We couldn't save the template. Try again.";

export const TITLE_ERROR = "Enter a task name, like “Set up laptop”.";
export const OWNER_ERROR = "Choose an owner for this task.";
export const DUE_ERROR = "Set a due date: enter the number of days, like 30.";
export const DUE_TOO_LATE_ERROR = `Day ${LATEST_DUE_DAY} is the latest allowed due date. Enter ${LATEST_DUE_DAY} or fewer.`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const taskCount = (n: number) => plural(n, "task");

/** "30 days before start", "Day 90 after start" or "On the start date". */
export function dueLabel(task: Pick<TemplateTask, "direction" | "days">): string {
  if (task.days === 0) return "On the start date";
  return task.direction === "before"
    ? `${plural(task.days, "day")} before start`
    : `Day ${task.days} after start`;
}

/** Signed days from the start date: negative before, 0 on the day, positive after. */
export function toOffset(task: Pick<TemplateTask, "direction" | "days">): number {
  return task.direction === "before" && task.days !== 0 ? -task.days : task.days;
}

export function fromOffset(offset: number): Pick<TemplateTask, "direction" | "days"> {
  return offset < 0 ? { direction: "before", days: -offset } : { direction: "after", days: offset };
}

/** Earliest due date first; tasks with the same offset keep their entry order. */
export function sortTasks<T extends Pick<TemplateTask, "direction" | "days">>(tasks: T[]): T[] {
  return tasks.slice().sort((a, b) => toOffset(a) - toOffset(b));
}

/** The whole number the days text holds, or null when it is empty or not a whole number. */
export function parseDays(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : null;
}

/** Client-side mirror of the API checks, so errors show inline before anything is sent. */
export function validateTask(draft: TaskDraft): TaskErrors {
  const errors: TaskErrors = {};
  if (draft.title.trim() === "") errors.title = TITLE_ERROR;
  if (draft.owner === null) errors.owner = OWNER_ERROR;
  const days = parseDays(draft.days);
  if (days === null) errors.due = DUE_ERROR;
  else if (draft.direction === "after" && days > LATEST_DUE_DAY) errors.due = DUE_TOO_LATE_ERROR;
  return errors;
}

type ApiTask = { title: string; owner: Owner; dueOffsetDays: number };

async function save(method: "POST" | "PUT", path: string, body: unknown): Promise<SaveResult> {
  try {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: unknown;
      taskIndex?: number;
    };
    const message = typeof data.message === "string" ? data.message : GENERIC_ERROR;
    if (res.status === 409 && data.code === "role_exists") {
      return { ok: false, kind: "role_exists", message };
    }
    if (res.status === 400) return { ok: false, kind: "invalid", message, taskIndex: data.taskIndex };
    return { ok: false, kind: "error", message: GENERIC_ERROR };
  } catch {
    return { ok: false, kind: "error", message: GENERIC_ERROR };
  }
}

const toApiTasks = (tasks: TemplateTask[]): ApiTask[] =>
  tasks.map((t) => ({ title: t.title, owner: t.owner, dueOffsetDays: toOffset(t) }));

/** Client side: creates the role's template. Never throws. */
export function createTemplate(role: string, tasks: TemplateTask[]): Promise<SaveResult> {
  return save("POST", TEMPLATES_API_PATH, { role, tasks: toApiTasks(tasks) });
}

/** Client side: replaces the role's template tasks. Never throws. */
export function updateTemplate(role: string, tasks: TemplateTask[]): Promise<SaveResult> {
  return save("PUT", `${TEMPLATES_API_PATH}/${encodeURIComponent(role)}`, {
    tasks: toApiTasks(tasks),
  });
}

async function getFromApi(path: string): Promise<Response> {
  // Imported here so the client-side helpers above never pull next/headers into the browser bundle.
  const { cookies } = await import("next/headers");
  const cookieHeader = (await cookies()).toString();
  return fetch(`${API_URL}/onboarding-templates${path}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

async function getJson<T>(path: string): Promise<T> {
  const res = await getFromApi(path);
  if (!res.ok) throw new Error(`Onboarding templates lookup failed (${res.status})`);
  return (await res.json()) as T;
}

/** Server side: every saved template with its task and plan counts. Throws on failure. */
export function getTemplates(): Promise<TemplateSummary[]> {
  return getJson<TemplateSummary[]>("");
}

/** Server side: the fixed job-role list. Throws on failure. */
export function getRoles(): Promise<JobRole[]> {
  return getJson<JobRole[]>("/roles");
}

/** Server side: one role's template, tasks earliest first; null when the role has none. */
export async function getTemplate(role: string): Promise<Template | null> {
  const res = await getFromApi(`/${encodeURIComponent(role)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Onboarding templates lookup failed (${res.status})`);
  const data = (await res.json()) as {
    role: string;
    name: string;
    planCount: number;
    tasks: ApiTask[];
  };
  return {
    role: data.role,
    name: data.name,
    planCount: data.planCount,
    tasks: data.tasks.map((t) => ({ title: t.title, owner: t.owner, ...fromOffset(t.dueOffsetDays) })),
  };
}
