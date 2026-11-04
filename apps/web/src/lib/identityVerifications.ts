import { cookies } from "next/headers";

export type Submission = {
  id: string;
  fullName: string;
  /** yyyy-mm-dd */
  dateOfBirth: string;
  idNumber: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  /** The deciding staff member's email. */
  decidedBy: string | null;
  /** ISO-8601 UTC. */
  decidedAt: string | null;
  submittedAt: string;
};

/** The customer's own latest submission; `none` when they never submitted. */
export type MyVerification = {
  status: "none" | "pending" | "approved" | "rejected";
  fullName: string | null;
  dateOfBirth: string | null;
  idNumber: string | null;
  rejectionReason: string | null;
};

export type Details = { fullName: string; dateOfBirth: string; idNumber: string };

export type ListResult = { ok: true; submissions: Submission[] } | { ok: false };
export type OneResult = { ok: true; submission: Submission } | { ok: false };
export type ActionResult =
  | { ok: true }
  | { ok: false; reason: "already-decided" | "invalid" | "failed"; message: string };
export type SubmitResult =
  | { ok: true; verification: MyVerification }
  | { ok: false; reason: "invalid" | "failed"; message: string };

/** "14 Mar 1988" from "1988-03-14"; fixed locale and UTC so server and client markup match. */
export function formatDateOfBirth(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export const GENERIC_FAILURE = "Something went wrong. Try again.";

// The browser calls /api/... on the web origin; next.config.ts rewrites it (cookies included) to the Records API.
// It is under /api because the pages own the plain paths.
const STAFF_API_PATH = "/api/staff/identity-verifications";
const CUSTOMER_API_PATH = "/api/identity-verification";
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";

async function serverGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`Identity verification lookup failed (${res.status})`);
  return (await res.json()) as T;
}

/** Server side: undecided submissions, oldest first. Throws if they cannot be read. */
export async function getPendingSubmissions(): Promise<Submission[]> {
  return (await serverGet<{ submissions: Submission[] }>("/staff/identity-verifications?status=pending")).submissions;
}

/** Server side: approved and rejected submissions, newest decision first. */
export async function getDecidedSubmissions(): Promise<Submission[]> {
  return (await serverGet<{ submissions: Submission[] }>("/staff/identity-verifications?status=decided")).submissions;
}

/** Server side: the signed-in customer's own verification. */
export function getMyVerification(): Promise<MyVerification> {
  return serverGet<MyVerification>("/identity-verification");
}

/** Browser side. Never throws: a failed read is `{ ok: false }`. */
export async function fetchSubmissions(status: "pending" | "decided"): Promise<ListResult> {
  try {
    const res = await fetch(`${STAFF_API_PATH}?status=${status}`, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    return { ok: true, submissions: ((await res.json()) as { submissions: Submission[] }).submissions };
  } catch {
    return { ok: false };
  }
}

export async function fetchSubmission(id: string): Promise<OneResult> {
  try {
    const res = await fetch(`${STAFF_API_PATH}/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    return { ok: true, submission: (await res.json()) as Submission };
  } catch {
    return { ok: false };
  }
}

export async function fetchMyVerification(): Promise<MyVerification | null> {
  try {
    const res = await fetch(CUSTOMER_API_PATH, { cache: "no-store" });
    return res.ok ? ((await res.json()) as MyVerification) : null;
  } catch {
    return null;
  }
}

async function message(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { message?: unknown };
  return typeof body.message === "string" ? body.message : GENERIC_FAILURE;
}

async function decide(id: string, verb: "approve" | "reject", body?: object): Promise<ActionResult> {
  try {
    const res = await fetch(`${STAFF_API_PATH}/${encodeURIComponent(id)}/${verb}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (res.ok) return { ok: true };
    const text = await message(res);
    if (res.status === 409) return { ok: false, reason: "already-decided", message: text };
    if (res.status === 400) return { ok: false, reason: "invalid", message: text };
    return { ok: false, reason: "failed", message: GENERIC_FAILURE };
  } catch {
    return { ok: false, reason: "failed", message: GENERIC_FAILURE };
  }
}

export const approveSubmission = (id: string) => decide(id, "approve");
export const rejectSubmission = (id: string, reason: string) => decide(id, "reject", { reason });

export async function submitVerification(details: Details): Promise<SubmitResult> {
  try {
    const res = await fetch(CUSTOMER_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(details),
    });
    if (res.ok) return { ok: true, verification: (await res.json()) as MyVerification };
    return { ok: false, reason: res.status === 400 || res.status === 409 ? "invalid" : "failed", message: await message(res) };
  } catch {
    return { ok: false, reason: "failed", message: GENERIC_FAILURE };
  }
}
