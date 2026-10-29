summary: |
  Let a patient tap an appointment card on the Upcoming or Past tab of the Appointments list and see a read-only detail view: clinic name, date and time in the clinic's local time zone (zone named), and the reason, or a muted "No reason given" when none was entered. A "Back to Appointments" button returns to the list (on the tab the patient came from). No reschedule or cancel action appears. The list already carries every field the detail needs, so the detail is client state inside AppointmentsScreen (no new route and no new endpoint). The one data gap is the clinic's IANA time zone, which the API's appointment view does not expose yet. It is added as one additive field, so the web app can name the zone and show the design's device-zone note.
scope:
  - description: |
      API: add the clinic's IANA zone to the appointment view. Before → after of the type:
      ```ts
      // before
      export type AppointmentView = { id; clinicId; clinicName; date; time; startsAt; reason };
      // after
      export type AppointmentView = { id; clinicId; clinicName; timeZone: string; date; time; startsAt; reason };
      ```
      `view()` sets `timeZone: clinic.timeZone`. `listFor` and `book` both go through `view()`, so both responses gain the field. The controller returns the view unchanged, so it needs no change.
    files:
      - services/api/src/appointments/appointments.service.ts
      - services/api/src/appointments/appointments.service.spec.ts
    rationale: |
      AC9 needs the clinic's zone to name it in the detail and to decide whether to show the device-zone note. `date` and `time` are already clinic-local (utcToClinicLocal in clinics.ts), so no conversion is added in the API.
  - description: |
      Web lib: add `timeZone` to the `Appointment` type and add pure helpers beside `describeAppointment` in appointments.ts:
      ```ts
      export const NO_REASON_TEXT = "No reason given";
      /** "Tue 3 Nov 2026, 09:30 GMT": clinic-local date and time, then the clinic zone's short name at that instant. */
      export function describeDateTime(a: Appointment): string;
      /** The detail's reason text: the reason, or NO_REASON_TEXT when empty or only whitespace. */
      export function reasonText(a: Appointment): string;
      /** Note for the detail when the device zone differs from the clinic zone; null when equal. */
      export function zoneNote(a: Appointment, deviceZone: string): string | null;
      ```
      `describeDateTime` builds the date part from `a.date` (calendar date, no zone, same as `dayLabel`) plus the year. It builds the zone name with `Intl.DateTimeFormat("en-GB", { timeZone: a.timeZone, timeZoneName: "short" })` at `a.startsAt`. The date and time are never re-converted in the browser, so the server's clinic-local values stay the source of truth. A bad zone string falls back to the date and time with no zone name.
    files:
      - apps/web/src/lib/appointments.ts
      - apps/web/src/lib/appointments.test.ts
    rationale: |
      Keeps the formatting and the "no reason" and zone rules out of the component so they are unit-testable with a fixed device zone, because a vitest run cannot rely on the machine's time zone.
  - description: |
      New component `AppointmentDetail` (props `{ appointment: Appointment; onBack: () => void }`), built from the approved prototype's "Appointment detail" screen. It renders a `.page.stack.stack-4` column holding:
      - a `.btn.btn-ghost` "Back to Appointments" button with the arrow-left icon (reuse `Icon` from components/orders/Icon.tsx if it has that glyph, else add the glyph there rather than a new component);
      - a `.title-row` with `<h1 id="detail-title">Appointment</h1>` and a `.badge` reading "Upcoming" or "Past";
      - a `.card.stack.stack-3` with `aria-labelledby="detail-title"` and three `.d-group` blocks (`.d-label` plus `.d-value`): Clinic (`<h2>`), Date and time, and Reason for visit. The reason has the `.d-reason` class, and `.is-empty` (muted, italic) when the text is "No reason given";
      - a `.alert.alert-info` with the info icon, shown inside the Date and time group only when `zoneNote()` is non-null, reading "Shown in <clinic zone>, the clinic's local time. Your device is on <device zone>.";
      - a closing `<p class="text-sm text-muted">To change this appointment, contact the clinic.</p>`. It is text only: no Reschedule or Cancel button, link or menu anywhere.
      Upcoming or Past comes from the same `splitUpcoming` result that AppointmentsScreen already computes (passed in as a prop), so the badge never disagrees with the tab. The device zone is read with `Intl.DateTimeFormat().resolvedOptions().timeZone` in a `useEffect` after mount (like `LocalTime`), so server and client markup match and the note appears after mount. Focus moves to the Back button when the detail opens (the prototype does this).
      CSS in globals.css, next to `.title-row` at line 163, using tokens only: `.d-group` (flex column, gap `var(--space-1)`), `.d-label` (`var(--font-size-sm)`, `var(--color-fg-muted)`), `.d-value` (overflow-wrap anywhere), `.d-reason.is-empty` (`var(--color-fg-muted)`, italic), `.back` (align-self flex-start), and `.appt` / `button.appt` for the tappable card (full width, left aligned, `font: inherit`, `color: inherit`, `var(--space-1)` gap, focus ring `var(--border-width-strong) solid var(--color-focus)` with offset `var(--size-focus-offset)`). tokens.css is already imported at globals.css line 2, so no loader work is needed.
    files:
      - apps/web/src/components/appointments/AppointmentDetail.tsx
      - apps/web/src/components/appointments/AppointmentDetail.test.tsx
      - apps/web/src/app/globals.css
    rationale: |
      The catalogue has no detail view, so this one is new (the design marks it NEW). It reuses the existing `.page`, `.title-row`, `.card`, `.badge`, `.btn-ghost` and `.alert-info` classes and `Icon`. No new colour or pixel literals.
  - description: |
      Wire the list to the detail in AppointmentsScreen. Add `const [openId, setOpenId] = useState<string | null>(null)`. Each list item becomes a full-width `<button type="button" class="card appt">` inside the `<li>`. It shows the clinic name (`.appt-patient`, semibold) over the date and time (`.text-muted`) and has `aria-label="Open appointment at {clinic}, {dayLabel}, {time}"`, and `onClick` sets `openId`. When `openId` matches an appointment, render `<AppointmentDetail onBack={() => setOpenId(null)} />` instead of the title row, tabs and list. `tab` state stays in the component, so Back returns to the Upcoming or Past tab the patient came from. The toast and the none-booked state are untouched.
    files:
      - apps/web/src/components/appointments/AppointmentsScreen.tsx
      - apps/web/src/components/appointments/AppointmentsScreen.test.tsx
    rationale: |
      Both tabs share `AppointmentList`, so one change covers AC1 and AC2. Holding the open id in component state avoids a new route and a second fetch, because the list already holds every field.
tests:
  - |
    AC1 and AC2, open from either tab (AppointmentsScreen.test.tsx). Written first. The existing test `lists the new booking with a link to book another` asserts the `<li class="card">text</li>` markup, so update it to the new button markup first. The static-markup tests keep working. For the click behaviour add `@testing-library/react` only if the repo already uses it (check `apps/web/package.json`); otherwise export a pure reducer and test it, or render AppointmentDetail directly.
    ```ts
    expect(html).toMatch(/<button[^>]*class="card appt"[^>]*aria-label="Open appointment at North Clinic, Mon 2 Nov, 09:00"/);
    expect(renderToStaticMarkup(<AppointmentsScreen ... initialTab="past" />)).toMatch(/<button[^>]*class="card appt"/);
    ```
  - |
    AC3 clinic name (AppointmentDetail.test.tsx).
    ```ts
    expect(html).toMatch(/<h2[^>]*class="d-value"[^>]*>North Clinic<\/h2>/);
    ```
  - |
    AC4 date and time, in clinic-local form (appointments.test.ts and AppointmentDetail.test.tsx).
    ```ts
    expect(describeDateTime({ ...booking, date: "2026-11-03", time: "09:30", startsAt: "2026-11-03T09:30:00.000Z", timeZone: "Europe/London" })).toBe("Tue 3 Nov 2026, 09:30 GMT");
    expect(html).toContain("Tue 3 Nov 2026, 09:30 GMT");
    ```
  - |
    AC5 reason shown.
    ```ts
    expect(reasonText({ ...booking, reason: "Blood pressure check" })).toBe("Blood pressure check");
    expect(html).toContain("Blood pressure check");
    ```
  - |
    AC6 no reason (empty or whitespace-only).
    ```ts
    expect(reasonText({ ...booking, reason: "" })).toBe("No reason given");
    expect(reasonText({ ...booking, reason: "   " })).toBe("No reason given");
    expect(renderToStaticMarkup(<AppointmentDetail appointment={{ ...booking, reason: "" }} onBack={() => {}} />)).toMatch(/class="d-value d-reason is-empty"[^>]*>No reason given</);
    ```
  - |
    AC7 read-only (AppointmentDetail.test.tsx).
    ```ts
    expect(html).not.toMatch(/reschedule|cancel/i);
    expect(html.match(/<button/g)).toHaveLength(1); // only Back
    ```
  - |
    AC8 back to the list (AppointmentsScreen.test.tsx). The Back button calls `onBack`. With a rendered tree or an extracted pure helper, after Back the screen shows the list and the tab the patient came from.
    ```ts
    const onBack = vi.fn();
    // find the button whose text is "Back to Appointments" in the rendered element tree and call its onClick
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(html).toContain("Back to Appointments");
    ```
    After Back: `expect(listHtml).toContain('role="tablist"')` and the Past tab stays selected when opened from Past.
  - |
    AC9 clinic time zone (appointments.test.ts, with the device zone passed in so the test does not depend on the machine).
    ```ts
    const ny = { ...booking, timeZone: "America/New_York", date: "2026-11-24", time: "10:00", startsAt: "2026-11-24T15:00:00.000Z" };
    expect(describeDateTime(ny)).toBe("Tue 24 Nov 2026, 10:00 GMT-5");
    expect(zoneNote(ny, "Europe/London")).toContain("clinic's local time");
    expect(zoneNote({ ...ny, timeZone: "Europe/London" }, "Europe/London")).toBeNull();
    ```
    API (appointments.service.spec.ts). `expect(a.timeZone).toBe('Europe/London')` on the `listFor` and `book` results, and the existing `toEqual` expectations are extended with `timeZone`.
assumptions_or_open_questions:
  - |
    OPEN (planning, from PROD-28OCT-EPIC-036): which time zone appointment times are shown in. The item's AC9 and the approved design answer it for this screen: the clinic's local zone, with the zone named and a note when the device differs. The API already formats `date` and `time` in the clinic zone, and the booking flow uses the same rule. All three fixture clinics are `Europe/London` today. The epic-wide question about clinic hours is not changed by this plan. Please confirm the clinic-local rule is final.
  - |
    The design shows zone names such as "London time (GMT)" and "New York time (EST)". The plan derives a short name from `Intl` (`timeZoneName: "short"`, en-GB), which gives "GMT" or "BST" for London but "GMT-5" for New York, not "EST". Matching the prototype's wording exactly would need a zone-name table, which is not planned. Say so if you want it.
  - |
    The detail is client state in AppointmentsScreen, so it has no URL of its own: the browser Back button leaves the Appointments page rather than closing the detail, and a refresh returns to the list. The design shows one screen filled from the tapped card with its own Back button, and the item asks for no deep link. A `/appointments/[id]` route is the alternative if that matters.
  - |
    The design's card is a single tappable button showing clinic plus short date/time, while the current list item shows the one-line `describeAppointment` text. The plan keeps the clinic and date text and makes the whole card a button. The existing list test that expects `<li class="card">text</li>` is changed accordingly.
  - |
    The prototype's note "To change this appointment, contact the clinic." is included because the design draws it. It is plain text, not an action. Remove it if you read AC7 as "no reschedule or cancel wording at all".
  - |
    The device zone note appears only after mount, since only the browser knows the device zone. Server markup and the static tests do not contain it.
  - |
    Privacy and retention questions (PROD-28OCT-CHORE-057) are not affected: no new data is stored and no health-data access logging is added. ADR-0012 records no compliance regime.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout
  None — one additive field (`timeZone`) on the API's computed appointment view. It is derived from the fixed in-code clinic list, not stored: no migration, no stored-data change, no setting, no seed. The web app and API deploy independently: until the API ships the field, the web helper falls back to showing date and time without a zone name and no device-zone note (the `timeZone` check is `typeof === "string"`). Rollback is reverting the commits.

  Design source: `PROD-28OCT-STORY-064-design.html`, screens "Appointments - Upcoming", "Appointments - Past" and "Appointment detail". The prototype's tokens.css is the same file the app already imports (`apps/web/src/app/globals.css` line 2), so all styling uses `var(--space-*)`, `var(--color-*)`, `var(--font-size-*)` and `var(--border-width-strong)`. One literal in the prototype, `.page { max-width: 40rem }`, is not used: the app's existing `.page` (globals.css line 162, `var(--size-modal)`) stays, matching the approved list screen. This is a small width difference from the prototype.

  ```mermaid
  flowchart TD
    page["app/appointments/page.tsx (getAppointments)"] --> screen["AppointmentsScreen.tsx: card buttons, openId state"]
    screen --> detail["AppointmentDetail.tsx (new): read-only view"]
    screen --> lib["lib/appointments.ts: describeDateTime, reasonText, zoneNote"]
    detail --> lib
    detail --> css["globals.css: .d-group .d-label .appt"]
    api["api appointments.controller.ts list()"] --> svc["appointments.service.ts view(): adds timeZone"]
    svc --> clinics["clinics.ts (CLINICS, utcToClinicLocal)"]
    page -. "fetches from" .-> api
    classDef touched fill:#f96,color:#000
    class screen,detail,lib,css,svc touched
  ```
  `screen` is touched to open and close the detail. `detail` is new. `lib` holds the pure formatting and rules. `css` adds the token-only classes. `svc` exposes the clinic zone.
review_focus: |
  IN scope: the read-only detail, the tappable cards on both tabs, the "No reason given" display, the clinic-local time with named zone and device-zone note, Back to the list, and one additive `timeZone` field on the API view. OUT: reschedule, cancel, a detail route, new endpoints, any change to booking or to the Upcoming/Past split. Riskiest part: time-zone display (the zone name from `Intl` differs from the prototype's wording, and tests must pass the device zone in rather than rely on the machine's zone). Deliberate: date and time are never re-converted in the browser (the server's clinic-local values are used), and the detail is component state, not a URL.
