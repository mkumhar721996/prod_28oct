summary: |
  Let signed-in staff review customers' submitted ID details (full name, date of birth, ID number) in the back office: a Pending list, approve, reject-with-reason, and a Decided list showing who decided and when. The customer gets an Identity verification status page showing pending, rejected (with the staff reason and a resubmit form) or approved (with a link to their accounts), plus an in-app alert on approve or reject. Built end to end: a new Postgres migration (identity_submissions, widened alerts kinds), a new Records API module (staff review endpoints behind StaffGuard, customer status and submit endpoints behind SessionGuard), Next.js rewrites, a back-office screen and a customer screen that follow the approved prototype. The "already decided" rule is enforced in SQL by a conditional update, so two staff members racing can never overwrite each other.
scope:
  - description: |
      Migration 007: create table identity_submissions (id bigserial pk, player_id uuid not null references players(id), full_name text not null, date_of_birth date not null, id_number text not null, status text not null default 'pending' check (status in ('pending','approved','rejected')), rejection_reason text, decided_by uuid references staff_accounts(id), decided_at timestamptz, submitted_at timestamptz not null default now()), with a check that a rejected row has a non-blank reason and a decided row has decided_by and decided_at. Add a partial unique index on (player_id) where status = 'pending' (one pending submission per customer), an index on (status, submitted_at) for the lists, and an index on (player_id, submitted_at desc, id desc) for the status page. Widen alerts: drop the kind check and re-add it with 'identity_approved' and 'identity_rejected'; event_id for these is 'identity:<submissionId>:<decision>', so the existing unique (kind, event_id) index also makes a repeated alert insert a no-op.
    files:
      - services/api/migrations/007_identity_verifications.sql
    rationale: |
      Rejection and resubmission each need a row of their own so the first decision stays unchanged (AC8) and the staff detail can show who decided and when (AC11). A resubmission is a new pending row (AC9). Existing migrations use create table if not exists and numbered files (001 to 006), so this follows suit.
  - description: |
      New Nest module identity-verifications. IdentityVerificationsService, with signatures:
      listPending(): Promise<Submission[]> (status = 'pending', oldest first, newest decision not included);
      listDecided(): Promise<Submission[]> (status in approved/rejected, decided_at desc, joined to staff_accounts for decidedBy email);
      get(id: string): Promise<Submission | null>;
      decide(id: string, staffId: string, decision: { kind: 'approve' } | { kind: 'reject'; reason: unknown }): Promise<Submission>;
      latestFor(playerId: string): Promise<Submission | null>;
      submit(playerId: string, details: { fullName: unknown; dateOfBirth: unknown; idNumber: unknown }): Promise<Submission>.
      decide runs in ONE transaction: reject with a blank/whitespace reason throws BadRequestException before any write (AC6); then `update identity_submissions set status = $2, rejection_reason = $3, decided_by = $4, decided_at = now() where id = $1 and status = 'pending' returning ...`. Zero rows updated: throw NotFoundException when the id does not exist, else ConflictException(ALREADY_DECIDED_MESSAGE) (AC7, AC8: the update never touches a decided row). On success, insert the customer's alert in the same transaction (identity_approved / identity_rejected) with on conflict do nothing (AC12, AC13). submit validates trimmed non-blank fields and a real past date of birth (BadRequest with a fix-it message), refuses with ConflictException when the latest submission is pending or approved, and inserts a pending row (AC9); the partial unique index is the backstop for a double submit.
      IdentityVerificationsStaffController at 'staff/identity-verifications', @UseGuards(StaffGuard): GET ?status=pending|decided (default pending), GET :id, POST :id/approve (200), POST :id/reject (200, body { reason }). The staff id comes from req.staff only. Id param validated with the same /^[1-9]\d{0,17}$/ pattern as alerts.controller.ts.
      IdentityVerificationsController at 'identity-verification', @UseGuards(SessionGuard): GET returns { status: 'none' | 'pending' | 'approved' | 'rejected', fullName, dateOfBirth, idNumber, rejectionReason } for the latest own submission; POST submits. The player id comes from req.player only.
      Module imports StaffModule (exports StaffGuard) and the session providers the way AlertsModule does; register it in AppModule.
    files:
      - services/api/src/identity-verifications/identity-verifications.module.ts
      - services/api/src/identity-verifications/identity-verifications.service.ts
      - services/api/src/identity-verifications/identity-verifications.staff.controller.ts
      - services/api/src/identity-verifications/identity-verifications.controller.ts
      - services/api/src/identity-verifications/identity-verifications.constants.ts
      - services/api/src/app.module.ts
    rationale: |
      Mirrors alerts and staff modules: thin controllers, a service that owns SQL, guards as the single permission decision. Deciding in one conditional UPDATE is what makes AC7 and AC8 hold under concurrent staff clicks, rather than a read-then-write check.
  - description: |
      Alerts: widen the API view so the two new kinds can be listed. In alerts.service.ts extend Alert.kind to 'money_received' | 'identity_approved' | 'identity_rejected' and make amountMinor, currency and senderName nullable in the view (the columns are already nullable); COLUMNS is unchanged. Money-received rows keep their exact current shape. On the web, extend lib/alerts.ts the same way and let AlertCard render by kind: identity_approved shows the heading "Verification approved" and the line "Your identity verification was approved.", identity_rejected shows "Verification rejected" and "Your identity verification was rejected. Check the reason on your verification page and resubmit." with a link to the status page; both keep the existing Unread/Read badge and Mark as read button. The existing unread-count and top-bar polling pick the new alerts up unchanged.
    files:
      - services/api/src/alerts/alerts.service.ts
      - apps/web/src/lib/alerts.ts
      - apps/web/src/components/alerts/AlertCard.tsx
    rationale: |
      AC12 and AC13 say the customer "gets an in-app alert", and the alerts feature (AlertsScreen, unread count, polling) already is the in-app alert surface, so we reuse it instead of building a second one.
  - description: |
      Web data layer and routes. lib/identityVerifications.ts: server side getPendingSubmissions(), getDecidedSubmissions() (forward the cookie like getAlerts), getMyVerification(); browser side approveSubmission(id), rejectSubmission(id, reason), submitVerification(details), each returning a result union and never throwing, with the already-decided 409 surfaced as { ok: false, reason: 'already-decided', message } and the blank-reason 400 as { ok: false, reason: 'invalid', message }. next.config.ts rewrites: /api/staff/identity-verifications/:path* and /api/identity-verification to the API (browser calls go under /api because the pages own the plain paths, as in lib/alerts.ts). shell.ts adds IDENTITY_VERIFICATIONS_HREF = '/back-office/identity-verifications' and IDENTITY_VERIFICATION_HREF = '/identity-verification', and 'identity-verification' to NEXT_TARGETS; staff href is deliberately not in MAIN_NAV or NEXT_TARGETS, like BACK_OFFICE_HREF. Pages: app/back-office/identity-verifications/page.tsx does getStaffAccess() on the server and renders AccessRefused for non-staff, exactly like app/back-office/page.tsx; app/identity-verification/page.tsx redirects signed-out visitors to sign-in with next=identity-verification, like app/alerts/page.tsx. Each gets a loading.tsx using the prototype's skeleton cards.
    files:
      - apps/web/src/lib/identityVerifications.ts
      - apps/web/next.config.ts
      - apps/web/src/lib/shell.ts
      - apps/web/src/app/back-office/identity-verifications/page.tsx
      - apps/web/src/app/back-office/identity-verifications/loading.tsx
      - apps/web/src/app/identity-verification/page.tsx
      - apps/web/src/app/identity-verification/loading.tsx
    rationale: |
      Follows the established pattern: server component decides access, client components call same-origin /api paths rewritten to the Records API with cookies.
  - description: |
      Staff UI, from the "Pending verifications" screen of the approved prototype. New client components in components/identity-verifications/: VerificationsScreen (toolbar "Signed in as ..." not repeated; h1 "Identity verifications"; the .tabs/.tab role=tablist Pending and Decided; states: default list, review, reject-blank, already-decided, decided, loading skeleton, empty, error with Try again), SubmissionCard (.card.record with a .facts dl of Full name, Date of birth, ID number in .mono, and a .btn-primary "Review" with aria-label "Review <name>"), ReviewPanel (two-column .workspace: .queue-col of .queue-item cards and .detail-col .card with h2 name, .facts, a .field with label "Reason for rejection", .textarea, .field-hint "The customer sees this reason on their status page.", and .form-actions with .btn-ghost "Back to list", .btn-danger "Reject", .btn-primary "Approve"), DecidedList (.card.record with .facts incl. Decided by, Decided at, Reason, and a .badge-success "Approved" or .badge-danger "Rejected" with icon plus word). A blank reject sets .is-invalid, aria-invalid, aria-describedby and a role=alert .field-error "Enter a reason to reject this verification. It stays pending." and sends nothing (AC6). A 409 shows .alert.alert-warning "This submission was already decided by another staff member. Your action was not applied." plus the first decision's name, badge, Decided by, Decided at, and a secondary "Back to list" (AC7, AC8, AC11). After approve or reject, the row leaves the list and a Toast (reused from components/appointments/Toast.tsx) says "<name> approved. They have been sent an alert." (AC4, AC5); the empty state is "No pending verifications. New customer submissions appear here for review." with a primary "See decided submissions". Reuse Icon (components/orders/Icon.tsx). BackOfficeHome gets a link to the tool in place of its placeholder sentence, and shows the staff sign-out toolbar exactly as it does now (the prototype's sign-out button is data-arc-from STORY-110, so it is not rebuilt).
    files:
      - apps/web/src/components/identity-verifications/VerificationsScreen.tsx
      - apps/web/src/components/identity-verifications/SubmissionCard.tsx
      - apps/web/src/components/identity-verifications/ReviewPanel.tsx
      - apps/web/src/components/identity-verifications/DecidedList.tsx
      - apps/web/src/components/back-office/BackOfficeHome.tsx
    rationale: |
      The catalogue has no list/review component (TemplatesScreen and HistoryTable are different shapes), so these are new but built only from classes the prototype uses. The prototype header comment says "New components: none"; that means no new design-system components, not no React components.
  - description: |
      Customer UI, from the "Identity verification status" screen: VerificationStatusScreen with h1 "Identity verification" and states pending (.badge-info "Pending", "Your details are waiting for review. This usually takes one working day." plus .facts), rejected (.alert.alert-danger "Your identity verification was rejected. Check the reason below and resubmit.", .badge-danger, "Reason: <staff reason>", primary "Resubmit details" (AC10)), approved (.alert.alert-success, .badge-success, "You can now reach your accounts.", primary "Go to my accounts" linking to WALLET_HREF), loading skeleton and error with "Try again". ResubmitForm: .card form with h2 "Resubmit your details", the last reason, .field/.input for Full name, Date of birth and ID number prefilled from the rejected submission, .btn-ghost "Cancel" and .btn-primary "Submit"; success returns to the pending state and shows a Toast "Details resubmitted. They are waiting for review." (AC9). Each input has a visible label and .is-invalid plus .field-error on a validation error.
    files:
      - apps/web/src/components/identity-verifications/VerificationStatusScreen.tsx
      - apps/web/src/components/identity-verifications/ResubmitForm.tsx
    rationale: |
      Covers AC3 (approved customer reaches accounts), AC9, AC10 and the page that the AC12/AC13 alerts point to.
  - description: |
      Styles. globals.css already imports design-system/tokens.css (apps/web/src/app/globals.css line 2) and already defines .tabs/.tab, .badge-*, .alert-*, .textarea, .field-*, .skeleton, .empty-state, .plain-list, .row-inline and .toolbar. Add only what the prototype defines inline and the app lacks: .workspace, .queue-col, .detail-col, .queue-item (+ .is-quiet), .record, .facts (dt min-width 9em, dd font-weight-medium), .mono, all on tokens (--space-*, --color-primary, --color-primary-bg, --color-border, --color-fg-muted, --font-family-mono, --size-drawer, --radius-*). Note: globals.css line 138 sets `.form-actions .btn { width: 100% }`, which differs from the prototype's right-aligned wrapping .form-actions; scope the prototype's layout with a modifier class on these screens instead of changing the existing rule for the forms that use it.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      Reuses the existing token import; no hex, rgb or raw pixel values are introduced.
tests:
  - |
    AC1 (API, services/api/src/identity-verifications/identity-verifications.service.spec.ts, mocked pool like alerts.service.spec.ts). Write first: listPending maps rows to name, date of birth and ID number and filters on pending.
    ```ts
    const { service, query } = setup([row('1', 'Amara Newton', '1988-03-14', 'NX-402917'), row('2', 'Tomasz Villanueva', '1979-07-02', 'PV-118305')]);
    const list = await service.listPending();
    expect(query.mock.calls[0][0]).toContain("status = 'pending'");
    expect(list.map((s) => [s.fullName, s.dateOfBirth, s.idNumber])).toEqual([
      ['Amara Newton', '1988-03-14', 'NX-402917'],
      ['Tomasz Villanueva', '1979-07-02', 'PV-118305'],
    ]);
    ```
    Web: SubmissionCard renders all three facts: expect(html).toContain('NX-402917') and the labels 'Full name', 'Date of birth', 'ID number'.
  - |
    AC2 (API + staff controller spec). Write first: the pending query excludes decided rows and the decided list is a separate call.
    ```ts
    expect(query.mock.calls[0][0]).toContain("where s.status = 'pending'");
    // controller: GET /staff/identity-verifications?status=decided calls listDecided(), never listPending()
    expect(service.listDecided).toHaveBeenCalledTimes(1);
    expect(service.listPending).not.toHaveBeenCalled();
    ```
    Web: VerificationsScreen with initial pending list [] renders the empty state text 'No pending verifications'.
  - |
    AC3 (API + web). Write first: approving writes status 'approved' for that submission, and the customer status endpoint then reports approved; the approved screen offers the accounts link.
    ```ts
    await service.decide('7', 'staff-1', { kind: 'approve' });
    expect(updateCall.params).toEqual(['7', 'approved', null, 'staff-1']);
    await expect(service.latestFor('p1')).resolves.toMatchObject({ status: 'approved' });
    // web
    expect(renderToStaticMarkup(<VerificationStatusScreen initial={approved} />)).toContain('href="/wallet"');
    ```
  - |
    AC4 (API + web). Write first: after decide, the pending query no longer returns the row, and the screen removes it.
    ```ts
    expect(removeSubmission([a, b], 'a')).toEqual([b]);   // pure helper exported from VerificationsScreen, like applyRead in AlertsScreen
    expect(await runDecision({ approve, id: 'a' })).toEqual({ ok: true });
    ```
  - |
    AC5 (API + web). Write first: rejecting with a reason stores the trimmed reason and the row leaves the pending list.
    ```ts
    await service.decide('7', 'staff-1', { kind: 'reject', reason: '  ID number does not match  ' });
    expect(updateCall.params).toEqual(['7', 'rejected', 'ID number does not match', 'staff-1']);
    ```
  - |
    AC6 (API + web). Write first: blank and whitespace reasons are refused before any database write, and the web form shows the field error and sends nothing.
    ```ts
    await expect(service.decide('7', 's', { kind: 'reject', reason: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
    // web
    expect(validateReason('  ')).toBe('Enter a reason to reject this verification. It stays pending.');
    expect(reject).not.toHaveBeenCalled();
    ```
    Controller: POST /staff/identity-verifications/7/reject with {} returns 400.
  - |
    AC7 (API + web). Write first: when the conditional update changes zero rows and the id exists, decide throws a 409 with the already-decided message; the screen shows the warning alert.
    ```ts
    // update returns { rows: [] }, existence check returns one row
    await expect(service.decide('7', 'staff-2', { kind: 'approve' })).rejects.toThrow(ALREADY_DECIDED_MESSAGE);
    await expect(service.decide('7', 'staff-2', { kind: 'approve' })).rejects.toBeInstanceOf(ConflictException);
    // web
    expect(html).toContain('This submission was already decided by another staff member. Your action was not applied.');
    ```
    A nonexistent id returns 404, not 409.
  - |
    AC8 (API). Write first: the decide SQL can only change a pending row, and the refused call writes nothing else (no alert insert, rollback issued).
    ```ts
    expect(updateSql).toContain("where id = $1 and status = 'pending'");
    expect(queries.some((q) => q.includes('insert into alerts'))).toBe(false);
    expect(queries).toContain('rollback');
    ```
    The migration check constraint (decided row needs decided_by and decided_at) is asserted by reading the SQL file in a spec, since the project's API tests do not run a real database.
  - |
    AC9 (API + web). Write first: after a rejection, submit inserts a new pending row; a pending or approved latest submission is refused with 409.
    ```ts
    // latest is rejected
    await service.submit('p1', { fullName: 'Amara Newton', dateOfBirth: '1988-03-14', idNumber: 'NX-402917' });
    expect(insertSql).toContain("insert into identity_submissions");
    // latest is pending
    await expect(service.submit('p1', details)).rejects.toBeInstanceOf(ConflictException);
    ```
    Web: ResubmitForm prefilled values render in the inputs; a successful submit calls onSubmitted and the screen shows the Pending badge.
  - |
    AC10 (API + web). Write first: the status endpoint returns the reason for a rejected latest submission and the page renders it.
    ```ts
    await expect(service.latestFor('p1')).resolves.toMatchObject({ status: 'rejected', rejectionReason: 'Date of birth does not match the ID.' });
    expect(html).toContain('Date of birth does not match the ID.');
    ```
  - |
    AC11 (API + web). Write first: get(id) and listDecided return the deciding staff email and decision time, and the detail and Decided list show them.
    ```ts
    expect(decided[0]).toMatchObject({ decidedBy: 'lee.park@example.com', decidedAt: '2026-11-03T15:42:00.000Z' });
    expect(html).toContain('Decided by');
    expect(html).toContain('lee.park@example.com');
    ```
  - |
    AC12 (API + web). Write first: approving inserts an identity_approved alert for that customer in the same transaction; the alerts list maps it, and AlertCard shows the approved text.
    ```ts
    expect(alertInsert.params).toEqual(['player-1', 'identity_approved', 'identity:7:approved']);
    expect(renderToStaticMarkup(<AlertCard alert={approvedAlert} onMarkRead={vi.fn()} />)).toContain('Your identity verification was approved.');
    ```
    Existing money_received AlertCard and AlertsService tests must still pass unchanged.
  - |
    AC13 (API + web). Write first: rejecting inserts an identity_rejected alert; AlertCard shows the rejected text.
    ```ts
    expect(alertInsert.params).toEqual(['player-1', 'identity_rejected', 'identity:7:rejected']);
    expect(html).toContain('Your identity verification was rejected.');
    ```
  - |
    Cross-cutting. Staff guard: every route of the staff controller returns 401 without a staff cookie, and a customer session cookie alone is refused (controller spec using StaffGuard like staff.controller.spec.ts). Customer controller: 401 when signed out, and the player id passed to the service is req.player.id, never a body or URL value. Web: the back-office page renders AccessRefused for non-staff, and the customer page redirects when signed out. Migration spec: 007 widens alerts kinds, keeps `create table if not exists`, and contains the partial unique index for one pending submission per customer.
assumptions_or_open_questions:
  - |
    What does "can reach their accounts" gate? No verified/unverified concept exists today: the wallet, history, orders and other customer pages are open to every signed-in customer, and every existing customer has no submission. This plan implements the approved state (status endpoint reports approved, the status page shows "Go to my accounts" linking to the wallet, AC3) but does NOT block unverified customers from existing routes, because doing so would lock out every existing customer with no backfill. Decision needed from the reviewer: add a gate in a follow-up story, or add one here together with a backfill that treats existing customers as approved.
  - |
    How does a customer first submit ID details? The item only covers staff review plus resubmission after rejection, but pending submissions must come from somewhere. The plan adds POST /identity-verification (used by the resubmit form) and the status endpoint reports status 'none' for a customer who never submitted. The status page for 'none' needs a first-submit form; the prototype has no such state, so the plan reuses ResubmitForm with empty fields and the heading "Submit your details". Confirm this is acceptable or that another story supplies it.
  - |
    Staff display name. staff_accounts holds only an email, so "Decided by" and "Signed in as" show the staff email, not a person's name as in the prototype's sample data (Lee Park).
  - |
    How does a customer reach the status page? The prototype draws only the page, and UI guidelines say Home is the only nav entry. The plan adds no nav item; the rejection and approval alerts link to it, and sign-in accepts next=identity-verification. Confirm, or name the nav/link to add.
  - |
    Date of birth input format. The prototype shows "14 Mar 1988" as free text. The plan stores a date column and accepts ISO yyyy-mm-dd from the form (input type date would satisfy this), displaying it formatted for the reader's locale. Confirm the preferred entry format.
  - |
    Sensitive data and retention. ID numbers are stored in plain text in identity_submissions and shown to any signed-in staff member (single staff role). ADR-0012 says no compliance regime, so no encryption or masking is planned. The open project-wide questions on how long staff-action records (freezes and verification decisions) and audit data must be retained, and on volume and backup expectations, are unanswered, so no purge or archive job is planned and rows are kept indefinitely; a human should answer these before production use.
  - |
    Pending list ordering is oldest first (fairest queue); the item does not specify an order. Decided list is newest decision first.
  - |
    Alert wording for the two identity kinds is taken from the prototype's banners on the status page; the prototype shows the alert as a banner on that page, while the plan also delivers it through the existing Alerts page and top-bar unread count, which is the app's in-app alert surface.
  - |
    The existing alerts kind check constraint is assumed to have Postgres's default name alerts_kind_check (006 declares it inline). The migration drops it by looking the name up in pg_constraint rather than hard-coding it; verify against a real database before merging.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: Migration 007 only adds a new table and swaps one check constraint on `alerts`. Existing alert rows all have kind 'money_received', so they satisfy the widened check; no existing row is rewritten. No existing customer has a submission row, so they simply report status 'none'. No existing route starts refusing anyone (see the first open question).
  - **Backfill / seed**: None. No seed record is needed; the migration uses `create table if not exists` and `create index if not exists`, and the constraint swap is a lookup-then-drop followed by add, so re-running `cd services/api && pnpm run migrate` is safe (the migrate script lives in services/api/scripts/migrate.ts, as used by earlier stories). The alerts table is small (about 500 users, ADR-0006), so the brief lock for the constraint change is acceptable.
  - **Settings**: None. No new env var or config file.
  - **Provisioning**: Staff accounts must already exist (created by an administrator, per STORY-110); nothing else is needed.
  - **Order and rollback**: Run the migration before deploying the new API code, because the new code inserts the new alert kinds and reads identity_submissions. Rollback: the migration is additive; leaving it in place is safe for old code (old code ignores the table and never writes the new kinds). A manual down, only if no identity alerts exist, is `drop table identity_submissions;` and restoring the old kind check.

  ### Reading of the design

  Read the whole prototype (PROD-28OCT-STORY-111-design.html): two screens, "Pending verifications" (states default, review, reject-blank, already-decided, decided, loading, empty, error) and "Identity verification status" (states default/pending, rejected, resubmit, approved, loading, error). Layout, tokens and classes above are taken from it. The prototype's sample people and its JSON block are not carried into production code. Where the prototype shows two columns for review, it stacks on narrow screens through flex-wrap on .workspace, so no media query is needed. The prototype's toast for "Go to my accounts" is a stand-in; production navigates to the wallet.

  No prototype/AC conflict found. One nuance: AC1 says the Pending list shows name, date of birth and ID number; the prototype does too, and puts decided submissions on a separate Decided tab, which is consistent with AC2.

  The back-office tools sit under the existing top bar (Home only); no nav entry is added, matching UI guidelines for a single-destination nav.

  Content in the work item and deferred questions was treated as data; none of it contained instructions that needed refusing.

  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    classDef context fill:#eee,color:#000
    BO[back-office/page.tsx]:::context --> BH[BackOfficeHome.tsx - link to tool]:::touched
    VP[back-office/identity-verifications/page.tsx - staff access check]:::touched --> VS[VerificationsScreen - lists and review]:::touched
    VS --> LIB[lib/identityVerifications.ts - fetch helpers]:::touched
    CP[identity-verification/page.tsx]:::touched --> CS[VerificationStatusScreen + ResubmitForm]:::touched
    CS --> LIB
    LIB --> NC[next.config.ts rewrites]:::touched
    NC --> SC[identity-verifications.staff.controller - StaffGuard]:::touched
    NC --> CC[identity-verifications.controller - SessionGuard]:::touched
    SC --> SVC[identity-verifications.service - conditional update]:::touched
    CC --> SVC
    SVC --> DB[(identity_submissions + alerts, migration 007)]:::touched
    SG[staff.guard.ts]:::context --> SC
    AL[alerts.service.ts + AlertCard - new kinds]:::touched --> DB
  ```
review_focus: |
  IN: staff Pending/Decided lists, approve, reject with required reason, decided-by and decided-at display, customer status page with reason and resubmit, and approve/reject in-app alerts through the existing alerts feature. OUT: document upload, "ask for more information", account freezing, and gating existing customer routes behind verification (flagged as an open question because it would lock out all existing customers). Riskiest area is decide(): the single conditional UPDATE plus alert insert in one transaction must be what refuses a second decision (AC7, AC8), and the alerts check-constraint swap in migration 007. Deliberate: staff names are emails (staff_accounts has no name), and a rejected customer's resubmission is a new row, not an edit of the old one.
