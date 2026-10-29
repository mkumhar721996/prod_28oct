summary: |
  Most of the Appointments screen already exists (AppointmentsScreen, NoAppointments, splitUpcoming, tabs, cards, the page that loads data). This item closes the gaps against the 13 ACs: (1) a patient with no appointments at all sees the none-booked screen with NO tabs (today tabs always render); (2) the Past list is ordered most recent first (today both lists are soonest first, as the API returns them); (3) a patient with only past appointments sees a short empty message on Upcoming rather than the full none-booked screen; (4) the Upcoming/Past boundary and ordering get pinned by tests, including "later today" vs "already passed today". Web-app only; no API, schema or dependency change.
scope:
  - description: |
      Add a pure sort to the lib and apply it in splitUpcoming so each list is ordered for its tab.
      Signature stays `splitUpcoming(all: Appointment[], now: Date): { upcoming: Appointment[]; past: Appointment[] }`;
      upcoming is sorted ascending by `Date.parse(startsAt)` (soonest first), past descending (most recent first). Do not rely on the API order and do not mutate the input.
      describeNext keeps working because it reads upcoming[0].
      Also change `describeAppointment(a: Appointment): string` so the card text is clinic, date and time only: `${a.clinicName}, ${dayLabel(a.date)}, ${a.time}`. Remove the reason preview and the now-unused REASON_PREVIEW_CHARS constant (describeAppointment is only used by the card, checked by grep).
    files:
      - apps/web/src/lib/appointments.ts
    rationale: ACs 7, 8, 9, 12, 13. The API orders by slot_start ascending, which is right for Upcoming but wrong for Past. The reviewer confirmed cards show clinic, date and time only.
  - description: |
      Rework AppointmentsScreen rendering:
      - If `appointments.length === 0`: render the title "Appointments" and the existing NoAppointments component only (empty-state with its single btn-primary "Book appointment" link). No tablist, no tabpanel. The title-row "Book appointment" button is omitted in this state so the view has exactly one btn-primary (UI guidelines).
      - Otherwise: title row with the primary "Book appointment" link, the tablist with Upcoming selected by default (initialTab still overrides), and the panel.
      - Upcoming tab with zero upcoming (only past exist): a short `<p className="text-muted">No upcoming appointments.</p>`, not NoAppointments (no second primary button, the title row already has one).
      - Cards: keep `ul.plain-list > li.card` list (AppointmentList) showing clinic, date and time only via describeAppointment (AC 9). Opening a card is out of scope (detail story).
      Styling uses existing classes only (.card, .tabs/.tab, .empty-state, .stack, .btn-primary, text-muted) from the design system tokens already loaded by the app; no new colours or pixel values.
    files:
      - apps/web/src/components/appointments/AppointmentsScreen.tsx
    rationale: ACs 1-6, 9, 10, 11. Builds sketch screens `appointments` (tabs, appointment-list cards) and `appointments-empty` (empty-state with book-first button) and the flows appointments-to-book / empty-to-book (links to BOOK_APPOINTMENT_HREF, already exits to the booking page).
  - description: |
      NoAppointments keeps its copy ("No upcoming appointments", benefit text, Book appointment link). Only change it if a test needs it; expected no change.
    files:
      - apps/web/src/components/appointments/NoAppointments.tsx
    rationale: AC 2 is already met by this component; listed so the reviewer sees it was checked and reused rather than replaced.
tests:
  - |
    AC 7/8/12/13 in apps/web/src/lib/appointments.test.ts (write first, fails today for past order):
    ```ts
    const now = new Date("2026-10-29T10:00:00Z");
    const { upcoming, past } = splitUpcoming(
      [mk("2026-11-20T08:00:00Z"), mk("2026-10-29T15:00:00Z"), mk("2026-10-01T09:00:00Z"), mk("2026-10-29T08:00:00Z")],
      now,
    );
    expect(upcoming.map((a) => a.startsAt)).toEqual(["2026-10-29T15:00:00Z", "2026-11-20T08:00:00Z"]);
    expect(past.map((a) => a.startsAt)).toEqual(["2026-10-29T08:00:00Z", "2026-10-01T09:00:00Z"]);
    ```
  - |
    AC 1/2/11 in AppointmentsScreen.test.tsx: none-booked screen, no tabs, one prompt.
    ```ts
    const html = render({});
    expect(html).toContain("No upcoming appointments");
    expect(html).toMatch(/<a[^>]*href="\/appointments\/book"[^>]*>Book appointment<\/a>/);
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
    expect(html.match(/Book appointment<\/a>/g)).toHaveLength(1);
    ```
  - |
    AC 3/6 in AppointmentsScreen.test.tsx: with one appointment both tabs show and Upcoming is selected.
    ```ts
    const html = render({ appointments: [booking] });
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Upcoming</);
    expect(html).toMatch(/role="tab"[^>]*aria-selected="false"[^>]*>Past</);
    ```
  - |
    AC 4/9 in AppointmentsScreen.test.tsx and appointments.test.ts: card shows clinic, date and time only. Update the existing assertions that expect the " — reason" suffix (AppointmentsScreen.test.tsx line 27, appointments.test.ts lines 41-44).
    ```ts
    expect(render({ appointments: [booking] })).toMatch(/<li class="card"[^>]*>North Clinic, Mon 2 Nov, 09:00<\/li>/);
    expect(render({ appointments: [booking] })).not.toContain("Blood pressure check");
    expect(describeAppointment({ ...base, reason: "x".repeat(80) })).toBe("North Clinic, Mon 2 Nov, 09:00");
    ```
  - |
    AC 5 in AppointmentsScreen.test.tsx: past card is shown on the Past tab.
    ```ts
    expect(render({ appointments: [past], initialTab: "past" })).toContain("North Clinic, Thu 1 Oct, 09:00");
    ```
  - |
    AC 7/8 rendered order in AppointmentsScreen.test.tsx: two upcoming render soonest first, two past render most recent first (compare indexOf of the two card texts, each in its own tab render).
    ```ts
    expect(html.indexOf("Tue 3 Nov")).toBeLessThan(html.indexOf("Fri 20 Nov"));
    ```
  - |
    AC 10 in AppointmentsScreen.test.tsx: only a past appointment, Upcoming tab shows a short message, not the none-booked screen.
    ```ts
    const html = render({ appointments: [past] });
    expect(html).toContain("No upcoming appointments.");
    expect(html).not.toContain("Pick a clinic and a time that suits you.");
    expect(html.match(/Book appointment<\/a>/g)).toHaveLength(1);
    ```
  - |
    AC 12/13 in AppointmentsScreen.test.tsx with NOW = 2026-10-29T10:00Z: one booking at 15:00Z today is in the Upcoming render; one at 08:00Z today is absent from Upcoming and present with initialTab "past".
    ```ts
    expect(render({ appointments: [later, earlier] })).toContain(describeAppointment(later));
    expect(render({ appointments: [later, earlier] })).not.toContain(describeAppointment(earlier));
    expect(render({ appointments: [later, earlier], initialTab: "past" })).toContain(describeAppointment(earlier));
    ```
  - |
    Verify narrowly with `(cd apps/web && pnpm test -- src/lib/appointments.test.ts src/components/appointments/AppointmentsScreen.test.tsx)`; existing page.test.tsx must still pass unchanged.
assumptions_or_open_questions:
  - |
    Sketch vs AC conflict: the sketch's `appointments-empty` screen draws the Upcoming/Past tabs, but AC 11 says no tabs when the patient has no appointments. The plan follows AC 11 (no tabs).
  - |
    Sketch vs UI guidelines: the sketch has a primary "Book appointment" in both the title row and the empty state; the guidelines allow one btn-primary per view. The plan keeps only the empty-state button in the none-booked view (AC 2 is still met) and only the title-row button otherwise.
  - |
    Settled by the reviewer: cards show clinic, date and time only. The sketch's patient name, doctor and department are not added, and the reason preview is dropped from the card.
  - |
    Open (planning, from PROD-28OCT-EPIC-036): which time zone clinic hours and appointment times are shown in. This plan changes nothing about it. Cards keep showing the server-formatted clinic-local date and time, while the Upcoming/Past split compares the UTC start instant to the server's current time, so it is zone-independent.
  - |
    Not applicable here, so not planned: records retention and backup, and privacy or audit-logging obligations (PROD-28OCT-CHORE-057). No new data is stored or exposed; ADR-0012 records no compliance regime. The book-slot-taken decision belongs to the booking story.
  - An appointment starting exactly at "now" counts as Upcoming (existing >= comparison), kept as is.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout
  None — web UI ordering and rendering only; no stored data, migration, setting or provisioning. Roll back by reverting the commit.

  The design sketch was read (screens `appointments` and `appointments-empty`, flow appointments-to-empty, exits to book-appointment). Tokens and styling are already wired through the existing classes AppointmentsScreen uses, so no stylesheet change is planned. Reused components: AppointmentsScreen, NoAppointments.
review_focus: |
  IN scope: ordering (lib), card text trimmed to clinic, date and time (reason preview removed on purpose), none-booked-without-tabs, short empty message on Upcoming, and tests; OUT: card detail/opening, booking, API, time zone handling. Riskiest part is the AppointmentsScreen branching (zero appointments vs zero upcoming) and keeping describeNext on the home page working after the sort change. Deliberate: the title-row button is hidden in the none-booked view to keep one primary button, and tabs are omitted there despite the sketch drawing them (AC 11 wins).
