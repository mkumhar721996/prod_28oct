// Keep in sync with REASON_MAX in services/api/src/appointments/appointments.service.ts and the check in services/api/migrations/003_appointments.sql (pinned by appointments.service.spec.ts).
export const REASON_MAX = 500;
const REASON_PREVIEW_CHARS = 60;

export type Clinic = { id: string; name: string; hoursText: string };
export type Slot = { date: string; time: string };
export type SlotDay = { date: string; times: string[] };
export type Appointment = {
  id: string;
  clinicId: string;
  clinicName: string;
  /** Clinic-local date (YYYY-MM-DD) and time (HH:mm), as the server formats them. */
  date: string;
  time: string;
  /** ISO-8601 UTC start of the slot. */
  startsAt: string;
  reason: string;
};

export type BookInput = { clinicId: string; date: string; time: string; reason: string };
export type BookResult =
  | { ok: true }
  | { ok: false; kind: "slot_taken" | "already_booked" | "error"; message: string };

// The browser calls /api/appointments on the web origin; next.config.ts rewrites it (cookies
// included) to the API. It is under /api because /appointments is the page itself.
const APPOINTMENTS_API_PATH = "/api/appointments";
const API_URL = process.env.RECORDS_API_URL ?? "http://localhost:3000";
const GENERIC_ERROR = "We couldn't book your appointment. Try again.";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Confirm is on once a clinic and a slot are chosen and the reason fits. */
export function canConfirm(state: {
  clinicId: string;
  slot: Slot | null;
  reasonLength: number;
}): boolean {
  return state.clinicId !== "" && state.slot !== null && state.reasonLength <= REASON_MAX;
}

export function reasonError(length: number): string | null {
  return length > REASON_MAX
    ? `Reason is ${length} characters. Shorten it to ${REASON_MAX} or fewer.`
    : null;
}

/** "2026-11-02" as "Mon 2 Nov"; the date is a calendar date, so no zone is involved. */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

export function describeAppointment(a: Appointment): string {
  const base = `${a.clinicName}, ${dayLabel(a.date)}, ${a.time}`;
  return a.reason ? `${base} — ${a.reason.slice(0, REASON_PREVIEW_CHARS)}` : base;
}

/** Splits bookings (soonest first) into upcoming and past by their start instant. */
export function splitUpcoming(
  all: Appointment[],
  now: Date,
): { upcoming: Appointment[]; past: Appointment[] } {
  const isUpcoming = (a: Appointment) => Date.parse(a.startsAt) >= now.getTime();
  return { upcoming: all.filter(isUpcoming), past: all.filter((a) => !isUpcoming(a)) };
}

/** "Tue 3 Nov, 09:30 at Central Clinic" for the soonest upcoming booking; null when none. */
export function describeNext(all: Appointment[], now: Date): string | null {
  const next = splitUpcoming(all, now).upcoming[0];
  return next ? `${dayLabel(next.date)}, ${next.time} at ${next.clinicName}` : null;
}

/** Client side: books a slot. Never throws. */
export async function bookAppointment(input: BookInput): Promise<BookResult> {
  try {
    const res = await fetch(APPOINTMENTS_API_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: unknown };
    const message = typeof body.message === "string" ? body.message : GENERIC_ERROR;
    if (res.status === 409 && (body.code === "slot_taken" || body.code === "already_booked")) {
      return { ok: false, kind: body.code, message };
    }
    return { ok: false, kind: "error", message: GENERIC_ERROR };
  } catch {
    return { ok: false, kind: "error", message: GENERIC_ERROR };
  }
}

/** Client side: free slots at a clinic. Rejects on failure. */
export async function fetchSlots(clinicId: string): Promise<SlotDay[]> {
  const res = await fetch(`${APPOINTMENTS_API_PATH}/clinics/${encodeURIComponent(clinicId)}/slots`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Slots request failed (${res.status})`);
  return (await res.json()) as SlotDay[];
}

async function getFromApi<T>(path: string): Promise<T> {
  // Imported here so the client-side helpers above never pull next/headers into the browser bundle.
  const { cookies } = await import("next/headers");
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}/appointments${path}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`Appointments lookup failed (${res.status})`);
  return (await res.json()) as T;
}

/** Server side: the signed-in patient's own bookings, soonest first. Throws on failure. */
export function getAppointments(): Promise<Appointment[]> {
  return getFromApi<Appointment[]>("");
}

/** Server side: the fixed clinic list. Throws on failure. */
export function getClinics(): Promise<Clinic[]> {
  return getFromApi<Clinic[]>("/clinics");
}
