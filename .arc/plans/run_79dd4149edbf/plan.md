summary: |
  Let a signed-in patient book an appointment on a full page (`/appointments/book`): pick a clinic from a fixed list, pick a 30-minute slot generated from that clinic's weekly hours (booked slots removed), optionally add a reason (max 500 chars), then Confirm (back to Appointments with an "Appointment booked" toast) or Cancel (back, nothing booked). The server is the authority: it re-checks the slot, rejects a slot someone else took (409 slot_taken), rejects a second booking by the same patient at an overlapping time (409 already_booked) and never double-books, even under concurrency, because unique indexes enforce it. Nothing appointment-related exists in the repo yet (grep for "appointment" found nothing), so this story also builds the minimum surface its acceptance criteria touch: the appointments tables and API in `services/api`, a minimal Appointments page (Upcoming list plus the none-booked empty state), the Home next-appointment card, and an Appointments nav entry. Tabs beyond a basic Upcoming/Past split, the read-only detail, rescheduling, cancelling and staff clinic screens are out of scope.

scope:
  - description: |
      Migration `003_appointments.sql`: one additive table `appointments`
      (id uuid pk, player_id uuid not null references players(id), clinic_id text not null,
      slot_start timestamptz not null (the slot's start as a UTC instant; shown in the clinic's time zone), reason text not null default ''
      check (char_length(reason) <= 500), created_at timestamptz not null default now()).
      Two unique indexes make double booking impossible: `appointments_clinic_slot_uniq (clinic_id, slot_start)`
      (a slot is taken by one patient) and `appointments_player_slot_uniq (player_id, slot_start)`
      (a patient cannot hold two bookings at the same time, at any clinic). Every slot is exactly 30 minutes on a
      30-minute grid, so "overlapping time" is equal to "same slot_start".
    files:
      - services/api/migrations/003_appointments.sql
    rationale: |
      Follows 002_wallet_entries.sql (`create ... if not exists`, plain SQL run by scripts/migrate.ts).
      Constraints in the database, not only in code, are what make ACs 3, 13, 15 and 16 hold under concurrent confirms.
  - description: |
      Clinics and slot generation as pure functions, no DB.
      `CLINICS: readonly Clinic[]` is a fixed list (Central Clinic Mon-Fri 09:00-11:00, North Clinic Mon 09:00-12:00,
      Riverside Clinic Tue and Thu 09:00-12:00, the same fixture as the approved prototype).
      ```ts
      export type Clinic = { id: string; name: string; timeZone: string; hoursText: string; hours: Partial<Record<0|1|2|3|4|5|6, [string, string]>> };
      export const SLOT_MINUTES = 30;
      export const BOOKING_WINDOW_DAYS = 14;
      export function slotsFor(clinic: Clinic, now: Date, taken: ReadonlySet<string>): { date: string; times: string[] }[];
      export function isOfferedSlot(clinic: Clinic, date: string, time: string, now: Date): boolean;
      export function clinicLocalToUtc(timeZone: string, date: string, time: string): Date;   // wall time in the clinic zone to a UTC instant
      export function utcToClinicLocal(timeZone: string, instant: Date): { date: string; time: string };
      ```
      Hours are wall-clock times in the clinic's `timeZone` (IANA name). Slots run from tomorrow (the clinic's local date) for 14 days, every 30 minutes
      with start in [open, close), minus `taken` keys (the UTC ISO instant of the slot), days with no free times omitted. The two zone helpers use the built-in
      `Intl.DateTimeFormat` (no new dependency). The API's wire format for a slot stays clinic-local `date` and `time` strings, and the server converts to UTC for storage
      and back for display, so the browser never converts zones.
    files:
      - services/api/src/appointments/clinics.ts
      - services/api/src/appointments/clinics.spec.ts
    rationale: ACs 1, 2 and 3. Pure functions are cheap to test and are reused by the booking check, so the list and the check can never disagree.
  - description: |
      `AppointmentsService` (inject `DatabaseService`) with
      ```ts
      listClinics(): Clinic[]
      slotsForClinic(clinicId: string): Promise<{ date: string; times: string[] }[] | null>   // null = unknown clinic
      listFor(playerId: string): Promise<AppointmentView[]>                                   // own rows only, soonest first
      book(playerId: string, input: { clinicId: string; date: string; time: string; reason: string }):
        Promise<{ ok: true; appointment: AppointmentView } | { ok: false; code: 'slot_taken' | 'already_booked' | 'not_offered' | 'reason_too_long' | 'unknown_clinic' }>
      ```
      `book` validates reason length (500), clinic and `isOfferedSlot`, then INSERTs and maps unique violation
      (pg code 23505) by constraint name: clinic index gives slot_taken, player index gives already_booked.
      No pre-check SELECT is relied on. Any other DB error is rethrown (becomes a 500).
      `AppointmentsController` (`@Controller('appointments')`, `@UseGuards(SessionGuard)`, player id from `req.player.id` only, as in WalletController):
      `GET /appointments/clinics`, `GET /appointments/clinics/:id/slots`, `GET /appointments`, `POST /appointments` (201 on success;
      409 with body `{ code, message }` for slot_taken / already_booked; 400 for the rest). Messages: "That time is no longer available. Pick another time. Nothing has been booked." and "You already have an appointment at this time. Pick a different time."
      Register `AppointmentsModule` in `app.module.ts`.
    files:
      - services/api/src/appointments/appointments.service.ts
      - services/api/src/appointments/appointments.service.spec.ts
      - services/api/src/appointments/appointments.controller.ts
      - services/api/src/appointments/appointments.controller.spec.ts
      - services/api/src/appointments/appointments.module.ts
      - services/api/src/app.module.ts
    rationale: Mirrors wallet.module/controller/service (SessionGuard, session-only player id, service owns SQL). ACs 11-13, 15, 16, 17-18 and 20 are decided here, server side.
  - description: |
      Web data layer `apps/web/src/lib/appointments.ts`: types, `REASON_MAX = 500`, `canConfirm(state)`, `reasonError(len)`,
      `bookAppointment(input): Promise<BookResult>` (client fetch, never throws; result is
      `{ok:true} | {ok:false, kind:'slot_taken'|'already_booked'|'error', message}`), `fetchSlots(clinicId)`,
      server-side `getAppointments()` and `getClinics()` reading the API with the forwarded cookie, in the style of `getWallet()` in `lib/session.ts`.
      Add routes in `lib/shell.ts`: `APPOINTMENTS_HREF = "/appointments"`, `BOOK_APPOINTMENT_HREF = "/appointments/book"`; append
      `{ key: "appointments", label: "Appointments", href: APPOINTMENTS_HREF }` to the END of `MAIN_NAV` (existing positions unchanged).
      Add rewrites in `next.config.ts` under `/api/appointments` (the page owns `/appointments`): `/api/appointments` to `${apiUrl}/appointments`
      and `/api/appointments/:path*` to `${apiUrl}/appointments/:path*`.
    files:
      - apps/web/src/lib/appointments.ts
      - apps/web/src/lib/appointments.test.ts
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/next.config.ts
    rationale: Same pattern as `lib/orders.ts` (`/api/orders` rewrite) and the wallet helpers; keeps the Confirm rule (ACs 4, 5, 17, 18) in one tested pure function.
  - description: |
      Booking page, from the prototype screen "Book appointment" (`.page` column, max-width 40rem, `stack stack-4`):
      `BookingScreen` (client) renders h1 "Book appointment"; an alert region (`role="alert" tabIndex={-1}`, focused when shown) with
      `.alert-warning` for slot taken and already booked and `.alert-danger` for generic failure; a `.field` "Clinic" `.select`
      with hint line showing the clinic's `hoursText`; a `.field` "Reason for visit (optional)" `.textarea` with a live `n / 500` counter and,
      over 500, `.is-invalid` plus `.field-error` "Reason is N characters. Shorten it to 500 or fewer."; the Time group (`ClinicSlotPicker`);
      a summary hint line; actions right-aligned: `.btn-secondary` Cancel and the single `.btn-primary` Confirm (disabled until clinic and slot
      are chosen and reason is at most 500; shows "Booking…" while pending and disables Cancel).
      `ClinicSlotPicker` is NEW (no catalogued component fits, as the prototype notes): per-day `role="group"` labelled by a day label (`Mon 2 Nov`)
      holding `.chip` buttons with `aria-pressed`, in a `.slots-box`; skeleton lines while slots load; "Choose a clinic to see free times." before a clinic is chosen.
      Behaviour: changing clinic clears the slot; choosing a slot clears the alert. Confirm calls `bookAppointment`: success then
      `router.push("/appointments?booked=1")`; `slot_taken` clears the chosen slot, refetches slots and shows the "no longer available" alert, stays on the page, books nothing;
      `already_booked` shows the warning and keeps the selection; `error` shows "We couldn't book your appointment" and KEEPS clinic, slot and reason, no toast.
      Cancel: `router.push("/appointments")` with no request. Server page `app/appointments/book/page.tsx` redirects signed-out visitors to sign-in (as `orders/page.tsx`).
      Tokens used: `--space-1/2/3/4`, `--radius-md`, `--size-control`, `--border-width`, `--color-border`, `--color-border-strong`, `--color-bg-subtle`, `--color-fg-muted`, `--color-danger`, `--color-primary`, `--color-primary-fg`, `--color-focus`, `--border-width-strong`, `--size-focus-offset`, `--font-size-sm`, `--font-weight-medium`.
    files:
      - apps/web/src/components/appointments/BookingScreen.tsx
      - apps/web/src/components/appointments/BookingScreen.test.tsx
      - apps/web/src/components/appointments/ClinicSlotPicker.tsx
      - apps/web/src/components/appointments/ClinicSlotPicker.test.tsx
      - apps/web/src/app/appointments/book/page.tsx
      - apps/web/src/app/appointments/book/page.test.tsx
    rationale: ACs 1-7, 9-13, 15-22. Alert and button states follow `ClaimCreditsPanel` (focus the failure alert, pending label). Alert, Icon, `.btn`, `.card`, `.skeleton`, `.empty-state` and `.tab` styles already exist in `globals.css` and are reused.
  - description: |
      Appointments page and entry points. `AppointmentsScreen` (client, patterned on `OrdersScreen`'s tablist and `NoOrders`): h1 "Appointments" in a title row with a
      `.btn-primary` "Book appointment" link to `/appointments/book`; Upcoming and Past tabs; the Upcoming panel lists bookings as `.card` rows
      (`Clinic, Mon 2 Nov, 09:30 — reason (first 60 chars)`), soonest first; when the patient has none, `NoAppointments` (`.empty-state`, h2 "No upcoming appointments",
      "Book your first visit online. Pick a clinic and a time that suits you.", one primary "Book appointment" link). When `?booked=1` is present the page shows a
      `Toast` (new tiny presentational component, `role="status"`, text "Appointment booked", auto-hides after 4 s) then `router.replace("/appointments")` so a refresh does not repeat it.
      Server page `app/appointments/page.tsx` guards the session and loads `getAppointments()`.
      Home (`app/page.tsx`): keep the title h1 and, for a signed-in patient, add a `.card` "Next appointment" with the soonest upcoming booking (or "Nothing booked yet") and the `.btn-primary` "Book appointment" link to `/appointments/book`.
      Add to `globals.css` the classes the prototype uses and the app does not yet have, tokens only: `.select`, `.textarea`, `.chip` (+ `[aria-pressed="true"]`), `.slots-box`, `.slot-list`, `.day-group`, `.counter`, `.toast`, `.alert-warning`, `.page` (max-width `var(--size-modal)`), `.title-row`, `.actions`.
    files:
      - apps/web/src/components/appointments/AppointmentsScreen.tsx
      - apps/web/src/components/appointments/AppointmentsScreen.test.tsx
      - apps/web/src/components/appointments/NoAppointments.tsx
      - apps/web/src/components/appointments/Toast.tsx
      - apps/web/src/app/appointments/page.tsx
      - apps/web/src/app/appointments/page.test.tsx
      - apps/web/src/app/page.tsx
      - apps/web/src/app/globals.css
    rationale: ACs 8, 10 and 14 need a list and the three entry points to exist. Only the minimum list is built; the full list/tabs/detail work belongs to the sibling stories of the epic.

tests:
  - |
    AC1 (API, clinics.spec.ts). Write first, fails because `CLINICS` does not exist:
    `expect(service.listClinics().map(c => c.id)).toEqual(['central','north','riverside'])` and that the same call for two different player ids returns the identical array (`expect(a).toEqual(b)`). Web: BookingScreen renders `screen.getAllByRole('option')` equal to "Choose clinic" plus the three names.
  - |
    Time zone (clinics.spec.ts, from the reviewer decision). `expect(clinicLocalToUtc('Europe/London', '2026-11-02', '09:00').toISOString()).toBe('2026-11-02T09:00:00.000Z')` and for a summer date `expect(clinicLocalToUtc('Europe/London', '2026-07-06', '09:00').toISOString()).toBe('2026-07-06T08:00:00.000Z')`; round trip `expect(utcToClinicLocal(tz, clinicLocalToUtc(tz, d, t))).toEqual({ date: d, time: t })`; a booking returned by `listFor` shows the clinic-local time, not the UTC time.
  - |
    AC2 (clinics.spec.ts). `const north = slotsFor(CLINICS.find(c => c.id === 'north')!, new Date(2026, 9, 29), new Set());`
    then `for (const d of north) { expect(new Date(d.date + 'T00:00').getDay()).toBe(1); for (const t of d.times) { expect(t >= '09:00' && t < '12:00').toBe(true); } }` and `expect(north[0].times).toEqual(['09:00','09:30','10:00','10:30','11:00','11:30'])`.
  - |
    AC3 (clinics.spec.ts plus service spec). `slotsFor(north, today, new Set(['2026-11-02|09:00']))` has no `09:00` on `2026-11-02`; service test with a mocked pool returning a taken row for another player asserts `slotsForClinic('north')` omits it for the current player: `expect(day.times).not.toContain('09:00')`.
  - |
    AC4 (lib/appointments.test.ts and BookingScreen.test.tsx). `expect(canConfirm({ clinicId: 'north', slot: null, reasonLength: 0 })).toBe(false)`; render, choose the clinic, `expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()`.
  - |
    AC5. `expect(canConfirm({ clinicId: 'north', slot: { date: '2026-11-02', time: '09:00' }, reasonLength: 0 })).toBe(true)`; after choosing a clinic and a chip, `expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()`.
  - |
    AC6 and AC7 (BookingScreen.test.tsx, parameterised over reason '' and 'Blood pressure check'). Mock `bookAppointment` to resolve `{ ok: true }` and `useRouter` push:
    `await user.click(confirm); expect(push).toHaveBeenCalledWith('/appointments?booked=1')`. AppointmentsScreen.test.tsx with `?booked=1`: `expect(await screen.findByRole('status')).toHaveTextContent('Appointment booked')` and `replace` called with `/appointments`.
  - |
    AC8 (appointments.service.spec.ts and AppointmentsScreen.test.tsx). After `book(...)` resolves ok, `listFor(playerId)` includes it: `expect(list.map(a => [a.date, a.time])).toContainEqual(['2026-11-02', '09:00'])` (clinic-local fields); the screen renders `screen.getByText(/North Clinic, Mon 2 Nov, 09:00/)`.
  - |
    AC9 and AC10 (BookingScreen.test.tsx). `await user.click(screen.getByRole('button', { name: 'Cancel' })); expect(push).toHaveBeenCalledWith('/appointments'); expect(bookAppointment).not.toHaveBeenCalled();`
  - |
    AC11, AC12 and AC13. Service (mocked pool throwing `{ code: '23505', constraint: 'appointments_clinic_slot_uniq' }`): `expect(await service.book(p, input)).toEqual({ ok: false, code: 'slot_taken' })`. Controller: `await expect(controller.book(req, body)).rejects.toMatchObject({ status: 409 })` with body code `slot_taken`. BookingScreen with `bookAppointment` resolving `{ ok: false, kind: 'slot_taken', message }`: `expect(screen.getByRole('alert')).toHaveTextContent('no longer available')`, `expect(push).not.toHaveBeenCalled()`, the chosen chip has `aria-pressed="false"` and slots are refetched. Supertest e2e style test in the API against the real routes: row count unchanged after the 409.
  - |
    AC14 (page tests). `render(<AppointmentsScreen initial=… />)` with bookings: `expect(screen.getByRole('link', { name: 'Book appointment' })).toHaveAttribute('href', '/appointments/book')`; with none: `within(screen.getByRole('heading', { name: 'No upcoming appointments' }).parentElement!)` has the same link; Home page test: the "Next appointment" card has the link with the same href.
  - |
    AC15 (service spec). Mocked pool throws 23505 with `constraint: 'appointments_player_slot_uniq'` for the same clinic and time: `expect(result).toEqual({ ok: false, code: 'already_booked' })`; no second row is returned by `listFor`.
  - |
    AC16 (service spec). Patient holds Central 2026-11-03 09:30, then books Riverside 2026-11-03 09:30: the player-slot constraint fires, `expect(result.ok).toBe(false)`, `expect(result.code).toBe('already_booked')`. UI: alert text contains "already have an appointment at this time" and the selection is kept.
  - |
    AC17 and AC18 (lib and BookingScreen). `expect(canConfirm({ clinicId: 'north', slot, reasonLength: 500 })).toBe(true)` and `...reasonLength: 501 ...` toBe(false); service `book` with a 501-char reason returns `{ ok: false, code: 'reason_too_long' }` and a 500-char one succeeds. UI: paste `'a'.repeat(501)` then `expect(confirm).toBeDisabled()`.
  - |
    AC19 (BookingScreen.test.tsx). With a 501-char reason: `expect(screen.getByText('Reason is 501 characters. Shorten it to 500 or fewer.')).toBeInTheDocument()`, the textarea has `aria-invalid="true"`, and with 500 chars the message is absent.
  - |
    AC20, AC21 and AC22 (BookingScreen.test.tsx). `bookAppointment` resolves `{ ok: false, kind: 'error', message }`:
    `expect(screen.getByRole('alert')).toHaveTextContent("We couldn't book your appointment")`; `expect(screen.getByLabelText('Clinic')).toHaveValue('north')`; `expect(screen.getByRole('button', { name: '09:00' })).toHaveAttribute('aria-pressed', 'true')`; `expect(screen.queryByText('Appointment booked')).toBeNull()`; `expect(push).not.toHaveBeenCalled()`. Service: a non-23505 DB error propagates (`await expect(service.book(...)).rejects.toThrow()`), so the controller yields a 500, not a 409.
  - |
    Nav and routes (shell.test.ts). Update the existing order assertion to `expect(MAIN_NAV.map(e => e.key)).toEqual(['home','wallet','orders','history','appointments'])`; signed-out visitors to `/appointments` and `/appointments/book` are redirected to sign-in.
  - |
    Narrow commands per task: `(cd services/api && pnpm run test -- appointments)` and `(cd apps/web && pnpm test -- appointments shell)`; the full configured command is run once at the end.

assumptions_or_open_questions:
  - |
    DECIDED by the reviewer: scheduling and display use clinic-local time; timestamps are stored in UTC (`timestamptz`) and presented in the clinic's time zone. "Today" and the 14-day window use the clinic's local date.
  - |
    DECIDED by the reviewer: all three clinics use the same time zone. The reply said "Europe/London/UX"; that is not a valid IANA identifier (the valid one is `Europe/London`, and "UX" looks like a typo for "UK"), so the plan uses `Europe/London` as the `timeZone` of every clinic in the fixture and tests. Please say so if a different zone was meant. It is one constant per clinic.
  - |
    The patient is the existing signed-in `players` row (SessionGuard, `req.player.id`); there is no separate patient entity. Booking requires sign-in.
  - |
    Slots are 30 minutes, generated for the next 14 days starting tomorrow, with 3 clinics (prototype values, confirmed by the reviewer for now; they are named constants so they can move to configuration later). "Overlapping" is therefore "same start", because every slot is on the same 30-minute grid. If clinics later offer varying lengths, the player index must become an exclusion constraint on a time range.
  - |
    Clinic names and hours (Central, North, Riverside) are the prototype's fixture data; the real clinic list is not given. AC2's example (Monday 09:00-12:00 only) matches North Clinic. Clinics live in code, not a table, since staff maintenance of clinics is out of scope.
  - |
    No Appointments list, Home card or nav item exists yet (searched the repo for "appointment", no hits), and no sibling story is merged. This plan builds a minimal list so ACs 8, 10 and 14 can be met. Agreed by the reviewer: if the sibling list story lands first, merge into its files, components, routes and tests rather than duplicating them (re-check the repo before implementing).
  - |
    The prototype shows a "Just booked" badge on the new booking; it is not in any AC, so it is left out. The toast has no Undo (the prototype's Undo button stays hidden).
  - |
    Epic-level deferred questions on record retention/backups and privacy/audit-logging regulations are not answerable here and do not change this plan; ADR-0012 records "No compliance regime". No audit logging is added.
  - |
    The prototype's "Prototype controls" panel and its simulated failure radios are reviewer tooling only and are not built.

estimated_points: 8

package_dependencies: []

notes: |
  ### Data & rollout

  - **Existing data**: new table only (`003_appointments.sql`); no existing table or row is altered, so all current players, wallets and sessions are unaffected. The foreign key points at `players(id)`, which already exists.
  - **Backfill / seed**: none. Clinics are a constant in code. The migration uses `create table/index if not exists`, so re-running it is safe.
  - **Settings**: none; no new env var (the web app reuses `RECORDS_API_URL` in `next.config.ts`).
  - **Provisioning**: nothing to create besides running migrations (`services/api/scripts/migrate.ts`).
  - **Order and rollback**: deploy order is migrate, then API, then web (the web calls new `/api/appointments` routes). Rollback: the table is additive and unused by older code, so it can stay in place; `drop table appointments` is the down step if needed.

  Test for existing data after migration: a migration test (or service spec against the migrated schema) that existing `players` rows still sign in and read their wallet, and that the appointments table starts empty so `listFor` returns `[]`.

  ### Design source

  Built from the approved prototype's screens "Health dashboard", "Appointments", "Appointments (none booked)" and "Book appointment". The prototype comment says the wireframe drew a modal but the story asks for a full page, so the page is used. The prototype's slot-taken behaviour (clear the chosen slot, remove it from the list) is followed. No AC conflicts with the prototype.

  Tokens: `apps/web/src/app/globals.css` line 2 already does `@import "../../../../design-system/tokens.css";` (Tailwind v4 via `@import "tailwindcss"` on line 1). New CSS goes in that file using `var(--token)` only; there are no colour or pixel literals (the 768px breakpoint is not used by this item). Decided by the reviewer: `.page` uses `max-width: var(--size-modal)` instead of the prototype's `40rem`, so the booking column is 480px (narrower than the prototype); follow tokens wherever one exists.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    Home[app/page.tsx]:::touched -->|next-appointment card| Lib[lib/appointments.ts]:::touched
    ApptPage[app/appointments/page.tsx]:::touched --> ApptScreen[AppointmentsScreen]:::touched
    BookPage[app/appointments/book/page.tsx]:::touched --> BookScreen[BookingScreen]:::touched
    BookScreen --> Picker[ClinicSlotPicker]:::touched
    BookScreen -->|bookAppointment| Lib
    ApptScreen --> Lib
    Lib -->|/api/appointments rewrite| Next[next.config.ts]:::touched
    Next --> Ctrl[AppointmentsController]:::touched
    Ctrl --> Svc[AppointmentsService]:::touched
    Svc --> Clinics[clinics.ts]:::touched
    Svc --> DB[DatabaseService]
    Ctrl --> Guard[SessionGuard]
    Svc --> Mig[003_appointments.sql]:::touched
    Shell[lib/shell.ts MAIN_NAV]:::touched --> TopBar[TopBar.tsx]
    AppMod[app.module.ts]:::touched --> Ctrl
  ```

review_focus: |
  IN: booking page, the server-side booking rule, the minimal Appointments list, Home card and nav entry needed to reach and see the result. OUT: tabs beyond Upcoming/Past, appointment detail, reschedule/cancel, staff clinic screens, audit logging. Riskiest part is `AppointmentsService.book`: the slot-taken and already-booked outcomes must come from the two unique indexes (pg 23505 mapped by constraint name), not from a read-then-write check, and any other DB error must stay a 500 so the generic-failure path (ACs 20-22) is not reported as "slot taken". Deliberate: times are stored as UTC and converted to and from each clinic's IANA time zone on the server only (all three clinics use `Europe/London`), `.page` width uses `--size-modal` rather than the prototype's 40rem, and the toast travels through a `?booked=1` query param because the booking page and list are separate routes.
