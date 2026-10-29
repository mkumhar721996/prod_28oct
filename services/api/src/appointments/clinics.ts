export type Clinic = {
  id: string;
  name: string;
  /** IANA zone the opening hours are written in. */
  timeZone: string;
  hoursText: string;
  /** Weekly hours by weekday (0 = Sunday), as wall-clock [open, close) in `timeZone`. */
  hours: Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, [string, string]>>;
};

export const SLOT_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 14;

const LONDON = 'Europe/London';
const weekdays = (open: string, close: string, days: (0 | 1 | 2 | 3 | 4 | 5 | 6)[]) =>
  Object.fromEntries(days.map((d) => [d, [open, close] as [string, string]]));

export const CLINICS: readonly Clinic[] = [
  {
    id: 'central',
    name: 'Central Clinic',
    timeZone: LONDON,
    hoursText: 'Open Monday to Friday, 09:00 to 11:00',
    hours: weekdays('09:00', '11:00', [1, 2, 3, 4, 5]),
  },
  {
    id: 'north',
    name: 'North Clinic',
    timeZone: LONDON,
    hoursText: 'Open Mondays, 09:00 to 12:00',
    hours: weekdays('09:00', '12:00', [1]),
  },
  {
    id: 'riverside',
    name: 'Riverside Clinic',
    timeZone: LONDON,
    hoursText: 'Open Tuesdays and Thursdays, 09:00 to 12:00',
    hours: weekdays('09:00', '12:00', [2, 4]),
  },
];

const pad = (n: number) => String(n).padStart(2, '0');
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMinutes = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(timeZone: string, instant: Date): Record<string, number> {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(instant)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}

/** The clinic's wall-clock date and time at a UTC instant. */
export function utcToClinicLocal(timeZone: string, instant: Date): { date: string; time: string } {
  const p = parts(timeZone, instant);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

/** The UTC instant at which the clinic's wall clock reads `date` `time`. */
export function clinicLocalToUtc(timeZone: string, date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5)));
  // Two passes settle the zone offset, including across a daylight-saving change.
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = parts(timeZone, new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wall - shown;
  }
  return new Date(guess);
}

const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Times a clinic opens for on one date, before any booking is removed. */
function timesOn(clinic: Clinic, date: string): string[] {
  const h = clinic.hours[weekdayOf(date)];
  if (!h) return [];
  const times: string[] = [];
  for (let m = toMinutes(h[0]); m < toMinutes(h[1]); m += SLOT_MINUTES) times.push(fromMinutes(m));
  return times;
}

/** The clinic-local dates a booking can be made for: tomorrow for BOOKING_WINDOW_DAYS days. */
function windowDates(clinic: Clinic, now: Date): string[] {
  const today = utcToClinicLocal(clinic.timeZone, now).date;
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => addDays(today, i + 1));
}

/** Free slots by clinic-local date; `taken` holds the UTC ISO instants already booked. */
export function slotsFor(
  clinic: Clinic,
  now: Date,
  taken: ReadonlySet<string>,
): { date: string; times: string[] }[] {
  return windowDates(clinic, now)
    .map((date) => ({
      date,
      times: timesOn(clinic, date).filter(
        (t) => !taken.has(clinicLocalToUtc(clinic.timeZone, date, t).toISOString()),
      ),
    }))
    .filter((d) => d.times.length > 0);
}

/** Whether the clinic offers this slot at all (ignoring bookings). */
export function isOfferedSlot(clinic: Clinic, date: string, time: string, now: Date): boolean {
  return windowDates(clinic, now).includes(date) && timesOn(clinic, date).includes(time);
}
