export type Hire = {
  id: string;
  name: string;
  role: string;
  roleName: string;
  startDate: string;
  managerName: string | null;
  planId: string | null;
};
export type PlanTask = {
  title: string;
  owner: string;
  assignee: string;
  dueOffsetDays: number;
  dueDate: string;
  status: "not_started";
};
export type Plan = {
  id: string;
  hireName: string;
  roleName: string;
  startDate: string;
  tasks: PlanTask[];
  doneCount: number;
};

export type CreatePlanResult =
  | { ok: true }
  | { ok: false; kind: "no_manager" | "no_template" | "plan_exists" | "error"; message: string };
export type SaveResult = { ok: true } | { ok: false; message: string };

// The browser calls /api/hires on the web origin; next.config.ts rewrites it (cookies included) to the
// API. It is under /api because /hires is the page itself.
const HIRES_API_PATH = "/api/hires";
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const GENERIC_ERROR = "Something went wrong. Try again.";

export const START_DATE_ERROR = "Enter a start date like 08/12/2026.";
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** DD/MM/YYYY to an ISO date (YYYY-MM-DD); null for other text or a day not on the calendar (31/02). */
export function parseDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** ISO date to the DD/MM/YYYY the start-date input shows. */
export function toInputDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** "1 November 2026"; read as plain calendar parts so no timezone can shift the day. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export const startDateSavedMessage = (iso: string) =>
  `Start date saved as ${formatDate(iso)}. Every due date moved with it.`;

export const assigneeLabel = (assignee: string): string => (assignee === "" ? "Unassigned" : assignee);

async function send(method: "POST" | "PATCH", path: string, body?: unknown): Promise<Response | null> {
  try {
    return await fetch(`${HIRES_API_PATH}${path}`, {
      method,
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/** Client side: creates the hire's plan from the role template. Never throws. */
export async function createPlan(hireId: string): Promise<CreatePlanResult> {
  const res = await send("POST", `/${encodeURIComponent(hireId)}/plan`);
  if (res === null) return { ok: false, kind: "error", message: GENERIC_ERROR };
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { code?: string; message?: unknown };
  const message = typeof data.message === "string" ? data.message : GENERIC_ERROR;
  if (data.code === "no_manager" || data.code === "no_template" || data.code === "plan_exists") {
    return { ok: false, kind: data.code, message };
  }
  return { ok: false, kind: "error", message: GENERIC_ERROR };
}

async function patch(hireId: string, body: unknown): Promise<SaveResult> {
  const res = await send("PATCH", `/${encodeURIComponent(hireId)}`, body);
  if (res === null || !res.ok) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}

/** Client side: saves the start date (ISO); every due date follows it. Never throws. */
export const saveStartDate = (hireId: string, startDate: string) => patch(hireId, { startDate });

/** Client side: saves the manager's name, or null for none. Never throws. */
export const saveManager = (hireId: string, managerName: string | null) => patch(hireId, { managerName });

/** Client side: the hire's plan as the API now computes it; null on any failure. Never throws. */
export async function refreshPlan(hireId: string): Promise<Plan | null> {
  try {
    const res = await fetch(`${HIRES_API_PATH}/${encodeURIComponent(hireId)}/plan`, {
      credentials: "include",
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as Plan) : null;
  } catch {
    return null;
  }
}

async function getFromApi(path: string): Promise<Response> {
  // Imported here so the client-side helpers above never pull next/headers into the browser bundle.
  const { cookies } = await import("next/headers");
  const cookieHeader = (await cookies()).toString();
  return fetch(`${API_URL}/hires${path}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

async function getOrNull<T>(path: string): Promise<T | null> {
  const res = await getFromApi(path);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Hires lookup failed (${res.status})`);
  return (await res.json()) as T;
}

/** Server side: the hire record; null when there is no such hire. Throws on failure. */
export const getHire = (id: string) => getOrNull<Hire>(`/${encodeURIComponent(id)}`);

/** Server side: the hire's plan, earliest due date first; null when it has none. Throws on failure. */
export const getPlan = (id: string) => getOrNull<Plan>(`/${encodeURIComponent(id)}/plan`);

/** Server side: the managers a hire can have. Throws on failure. */
export async function getManagers(): Promise<string[]> {
  const res = await getFromApi("/managers");
  if (!res.ok) throw new Error(`Hires lookup failed (${res.status})`);
  return (await res.json()) as string[];
}
