summary: |
  Give bank staff a separate, protected way into a minimal back office. Staff live in their own tables (`staff_accounts`, `staff_sessions`) and get their own cookie (`staff_session`), so a customer session or customer credentials can never open a back-office page (ACs 2, 3). The Records API (NestJS) gets a `staff` module with sign-in, sign-out, current-session and an always-refusing register endpoint (ACs 1, 5, 6, 8). A `StaffGuard` enforces a sliding 15-minute idle timeout in the data layer (ACs 9, 10). An operator-run script creates staff accounts (AC 7). The Web App (Next.js) gets `/back-office`, `/back-office/sign-in` and `/back-office/register`, built from the approved prototype. Signed-out, customer and expired visitors see an "Access refused" screen with no back-office content (AC 4). The staff tools themselves (freeze account, identity review) are out of scope.

scope:
  - description: |
      Migration `005_staff.sql` (idempotent, same style as 004). Two new tables, no change to `players` or `sessions`.
      ```sql
      create table if not exists staff_accounts (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        password_hash text not null,
        created_at timestamptz not null default now()
      );
      create table if not exists staff_sessions (
        token_hash text primary key,
        staff_id uuid not null references staff_accounts (id),
        last_activity_at timestamptz not null default now()
      );
      create index if not exists staff_sessions_staff_id_idx on staff_sessions (staff_id);
      ```
    files:
      - services/api/migrations/005_staff.sql
    rationale: |
      Separate tables mean a customer row can never authenticate on the staff sign-in, however `players.account_role` is set. There is a single staff role, so no role column is needed.

  - description: |
      `StaffService` and `StaffSessionService` in a new `services/api/src/staff/` module.
      ```ts
      export const STAFF_SESSION_COOKIE = 'staff_session';
      export const STAFF_IDLE_MS = 15 * 60 * 1000;
      export type StaffMember = { id: string; email: string };
      export type StaffResolution =
        | { ok: true; staff: StaffMember }
        | { ok: false; reason: 'signed-out' | 'expired' };

      // StaffService
      authenticate(email: unknown, password: unknown): Promise<StaffMember | null>; // same dummy-hash timing trick as PlayersService.authenticate
      create(email: unknown, password: unknown): Promise<StaffMember>;              // validates with EMAIL_PATTERN and the password length limits; 409 on duplicate

      // StaffSessionService
      start(res: Response, staffId: string): Promise<void>;
      resolve(cookieHeader: string | undefined): Promise<StaffResolution>;
      end(cookieHeader: string | undefined, res: Response): Promise<void>;
      ```
      `resolve` is one atomic statement that slides the window and only matches a row still inside it:
      `update staff_sessions s set last_activity_at = now() from staff_accounts a where s.token_hash = $1 and s.last_activity_at > $2 and a.id = s.staff_id returning a.id, a.email`
      with `$2 = new Date(Date.now() - STAFF_IDLE_MS)`. A miss does a `select 1` on the token hash: a row found means `expired`, no row means `signed-out`. Taking the cutoff from `Date.now()` lets jest fake timers pin the 14-minute and 15-minute boundaries. The comparison is strict, so exactly 15 minutes idle is refused. Reuse `readCookie`, the token hashing and `cookieOptions` logic from `session.service.ts` (export the hashing helper rather than copy it) and `PasswordService` from `players/password.service.ts`.
    files:
      - services/api/src/staff/staff.service.ts
      - services/api/src/staff/staff-session.service.ts
      - services/api/src/staff/staff.constants.ts
      - services/api/src/session/session.service.ts
      - services/api/src/staff/staff.service.spec.ts
      - services/api/src/staff/staff-session.service.spec.ts
    rationale: |
      Mirrors `PlayersService` and `SessionService`. Idle expiry is enforced server side on every request, never trusted to the browser. Customer sessions (7-day absolute) stay unchanged.

  - description: |
      `StaffGuard`, `StaffController` and `StaffModule`, registered in `app.module.ts`.
      ```ts
      @Controller('staff/session')
      POST   sign-in   // 200 {email}; 401 'Sign-in refused' for wrong password, unknown email, or a customer email
      POST   register  // always 403 'Staff accounts are created by an administrator. No account was created.'; writes nothing
      POST   sign-out  // 204; deletes the staff_sessions row and clears the cookie
      GET    /         // StaffGuard; 200 {email}
      ```
      `StaffGuard` calls `StaffSessionService.resolve` and sets `req.staff`. On refusal it throws `UnauthorizedException({ reason })`, so the web app can show the right text. Reuse `AttemptLimiter` with the same pattern as `SessionController.signIn` (reserve the attempt before the first await, release on success), using keys prefixed `staff-sign-in-ip:` and `staff-sign-in-email:`. The sign-in refusal message is identical for every failure cause.
    files:
      - services/api/src/staff/staff.guard.ts
      - services/api/src/staff/staff.controller.ts
      - services/api/src/staff/staff.module.ts
      - services/api/src/app.module.ts
      - services/api/src/staff/staff.guard.spec.ts
      - services/api/src/staff/staff.controller.spec.ts
      - services/api/test/staff.e2e-spec.ts
    rationale: |
      The guard is the reusable seam that later staff tools (freeze, verification) will apply to their routes. It is the single place that decides "staff or refused". Lockout reuses the existing limiter, which answers the deferred question on lockout.

  - description: |
      Operator-run account creation for AC 7 (there is no in-app administrator role, and the item scopes a single staff role). Add `create-staff` to the API `package.json` scripts. It reads `STAFF_EMAIL` and `STAFF_PASSWORD` from the environment, not argv, so the password stays out of shell history and the process list. It calls `StaffService.create` through a Nest standalone application context, so the validation and hashing are the ones the tests cover. It prints only the email.
    files:
      - services/api/scripts/create-staff.ts
      - services/api/package.json
    rationale: |
      The script is thin and the logic lives in the tested service. The runnable form (ts-node or compiled output) is decided against how the API builds. `migrate.ts` is plain strip-types and cannot import decorated Nest classes.

  - description: |
      Web data layer. `lib/staffSession.ts` adds server-side `getStaffAccess()` and client-side `signInStaff`, `registerStaff` and `signOutStaff`. `lib/shell.ts` gains `BACK_OFFICE_HREF = "/back-office"`, `STAFF_SIGN_IN_HREF = "/back-office/sign-in"` and `STAFF_REGISTER_HREF = "/back-office/register"`. They are NOT added to `MAIN_NAV` or `NEXT_TARGETS`. `next.config.ts` gets a rewrite for `/staff/session/:path*` to the API, like the existing `/session/*` rewrite.
      ```ts
      export type StaffAccess =
        | { status: "staff"; email: string }
        | { status: "refused"; reason: "signed-out" | "customer" | "expired" };
      export async function getStaffAccess(): Promise<StaffAccess>;
      ```
      `getStaffAccess` forwards cookies to `GET /staff/session`. On 401 it takes `reason` from the body. If the reason is `signed-out` it also calls the existing `getSession()`, and a non-null customer session becomes `customer`. Any other failure throws. A cookie-less or failed lookup must never resolve to `staff`.
    files:
      - apps/web/src/lib/staffSession.ts
      - apps/web/src/lib/staffSession.test.ts
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/next.config.ts
    rationale: |
      Mirrors `lib/session.ts`. The access decision is made on the server in the page, so refused visitors never receive back-office markup.

  - description: |
      Web UI, taken from the approved prototype (`PROD-28OCT-STORY-110-design.html`).
      - **Staff sign-in screen**. A `.narrow` column with a `.card.stack`, an `h1` "Staff sign in", `.field`s "Email" and "Password" (`autocomplete` username and current-password), the button "Sign in" (disabled and "Signing in…" while pending), and "No staff account? Register". A refusal shows ONE `.field-error` line with an alert icon: "Sign-in refused. Check your details or contact an administrator." Both inputs get `.is-invalid` and `aria-describedby` pointing at the error, the password is cleared, and focus moves to the password input. Extend the existing `SignInForm` with optional props (`title`, `signIn`, `registerHref`, `registerPrompt`, `refusalMessage`) instead of a second form. Defaults keep the customer form unchanged.
      - **Staff register screen**. A new `StaffRegisterForm`, because its behaviour is the opposite of `RegisterForm` (it never creates an account). The `.card.stack` has "Register", Email, Password, "Create account" ("Creating account…" while pending) and a "Back to sign in" link. It always ends in the `.field-error` "Staff accounts are created by an administrator. No account was created." and never navigates.
      - **Back-office home** (`/back-office`). A new `BackOfficeHome` has a toolbar with a right-aligned `.btn.btn-ghost` "Sign out" (user icon), an `h1` "Back-office tools", and a `.card` holding a `.empty-state` with "Review identity verifications and freeze accounts will appear here." plus a `.badge.badge-info` "Signed in as staff". Sign out calls `signOutStaff`, then `router.replace(STAFF_SIGN_IN_HREF)` and shows the existing `Toast` "You are signed out".
      - **Access refused**. A new `AccessRefused` is a `.empty-state` with `role="alert"`, `h1` "Access refused", "Sign in with a staff account to open this page.", a reason line (`.text-sm`) and a `.btn.btn-primary` "Staff sign in". The reason lines are exactly the prototype's: signed-out "You are signed out, so the back-office page was not shown.", customer "Customer accounts cannot open back-office pages.", expired "Your session ended after 15 minutes without activity."
      - The pages are server components. `back-office/page.tsx` calls `getStaffAccess()` and renders `BackOfficeHome` only for `staff`, otherwise `AccessRefused` with nothing else.
      Tokens (already loaded by `apps/web/src/app/globals.css` line 2, `@import "../../../../design-system/tokens.css"`): `--space-3`, `--space-4`, `--color-danger`, `--color-fg-muted`, `--size-modal`, `--size-shell-max`, `--font-size-sm`. The classes `.card`, `.field`, `.input`, `.is-invalid`, `.field-error`, `.empty-state`, `.badge-info`, `.btn-*`, `.narrow` and `.stack` already exist in `globals.css`. Add only the missing ones (`.toolbar`, `.row-inline`) there, from the prototype's `var(--token)` rules, with no literals.
      Prototype-only parts are NOT built: the "try these accounts" box, the session simulator, and the prefilled email.
    files:
      - apps/web/src/components/SignInForm.tsx
      - apps/web/src/components/back-office/StaffRegisterForm.tsx
      - apps/web/src/components/back-office/BackOfficeHome.tsx
      - apps/web/src/components/back-office/AccessRefused.tsx
      - apps/web/src/app/back-office/page.tsx
      - apps/web/src/app/back-office/sign-in/page.tsx
      - apps/web/src/app/back-office/register/page.tsx
      - apps/web/src/app/globals.css
      - apps/web/src/components/back-office/BackOfficeHome.test.tsx
      - apps/web/src/components/back-office/AccessRefused.test.tsx
      - apps/web/src/components/back-office/StaffRegisterForm.test.tsx
      - apps/web/src/app/back-office/page.test.tsx
      - apps/web/src/components/AuthForms.test.tsx
    rationale: |
      Reuses `SignInForm`, `Toast` and the shell classes. The only new components are those with no catalogue equivalent.

tests:
  - |
    AC1 (staff sign-in opens the tools). API, `staff.controller.spec.ts`, written first.
    ```ts
    staff.authenticate.mockResolvedValue({ id: 's1', email: 'amira.hassan@bank.example' });
    await expect(controller.signIn({ email: 'amira.hassan@bank.example', password: 'Staff-pass1' }, req, res))
      .resolves.toEqual({ email: 'amira.hassan@bank.example' });
    expect(sessions.start).toHaveBeenCalledWith(res, 's1');
    ```
    Web, `back-office/page.test.tsx`:
    ```ts
    getStaffAccess.mockResolvedValue({ status: 'staff', email: 'a@bank.example' });
    render(await BackOfficePage());
    expect(screen.getByRole('heading', { name: 'Back-office tools' })).toBeInTheDocument();
    ```
  - |
    AC2 (a signed-in customer is refused). API `staff.guard.spec.ts`: a request carrying only `session=<customer token>` (no `staff_session` cookie) gets 401.
    ```ts
    staffSessions.resolve.mockResolvedValue({ ok: false, reason: 'signed-out' });
    await expect(guard.canActivate(ctx({ cookie: 'session=cust' }))).rejects.toBeInstanceOf(UnauthorizedException);
    ```
    Web: `getSession` resolves `{ role: 'player' }` while the staff lookup is 401, so `getStaffAccess()` returns `{ status: 'refused', reason: 'customer' }`, and the page shows "Customer accounts cannot open back-office pages." and no "Back-office tools" heading.
  - |
    AC3 (customer credentials on the staff sign-in are refused). `staff.service.spec.ts`: the staff table has no row for a customer email.
    ```ts
    pool.query.mockResolvedValue({ rows: [] });
    expect(await service.authenticate('jo.carter@example.com', 'Cust-pass1')).toBeNull();
    ```
    `staff.controller.spec.ts`: `await expect(controller.signIn(...)).rejects.toBeInstanceOf(UnauthorizedException); expect(sessions.start).not.toHaveBeenCalled();`. The e2e spec registers a customer through `/session/register` and then confirms `/staff/session/sign-in` returns 401.
  - |
    AC4 (signed-out visitor sees no back-office content). Web `back-office/page.test.tsx`:
    ```ts
    getStaffAccess.mockResolvedValue({ status: 'refused', reason: 'signed-out' });
    render(await BackOfficePage());
    expect(screen.getByRole('alert')).toHaveTextContent('You are signed out, so the back-office page was not shown.');
    expect(screen.queryByText('Back-office tools')).toBeNull();
    ```
    API e2e: `GET /staff/session` with no cookie returns 401.
  - |
    AC5 (wrong password refused). `staff.service.spec.ts`: `authenticate` with a wrong password returns null and runs one password verify. The controller spec expects `UnauthorizedException` and `sessions.start` not called. Web (extend the sign-in tests): a refused result shows ONE `.field-error` with the prototype copy, both inputs have `aria-invalid` or `.is-invalid`, the password is cleared, and `replace` is not called. A test sends the same message for wrong password and customer credentials.
    ```ts
    expect(deps.replace).not.toHaveBeenCalled();
    ```
  - |
    AC6 (registering creates nothing). `staff.controller.spec.ts`:
    ```ts
    await expect(controller.register({ email: 'x@bank.example', password: 'Whatever-123' }, req))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(pool.query).not.toHaveBeenCalled();
    expect(sessions.start).not.toHaveBeenCalled();
    ```
    `StaffRegisterForm.test.tsx`: submitting shows "Staff accounts are created by an administrator. No account was created." and never calls `router.replace`.
  - |
    AC7 (administrator-created staff member can sign in). `staff.service.spec.ts`: `create` stores a scrypt hash, never the plain password, and returns `{ id, email }`. A duplicate email gives `ConflictException`, and an invalid email or short password gives `BadRequestException`. The e2e spec calls `StaffService.create('new.hire@bank.example', 'Welcome-2026')` and then `POST /staff/session/sign-in` returns 200 with a `staff_session` cookie (`HttpOnly`, `SameSite=Lax`).
    ```ts
    expect(pool.query.mock.calls[0][1][1]).not.toBe('Welcome-2026');
    ```
  - |
    AC8 (sign-out refuses the back-office pages). `staff-session.spec`: `end` deletes the row by hashed token and clears the cookie.
    ```ts
    expect(pool.query).toHaveBeenCalledWith('delete from staff_sessions where token_hash = $1', [hash]);
    expect(res.clearCookie).toHaveBeenCalledWith(STAFF_SESSION_COOKIE, expect.any(Object));
    ```
    The e2e spec signs in, signs out, then `GET /staff/session` with the old cookie returns 401. Web `BackOfficeHome.test.tsx`: clicking "Sign out" calls `signOutStaff`, then `replace(STAFF_SIGN_IN_HREF)` and shows the "You are signed out" toast.
  - |
    AC9 (15 minutes idle ends the session). `staff-session.service.spec.ts` with `jest.useFakeTimers()`. The mock pool applies the cutoff passed as `$2`.
    ```ts
    jest.setSystemTime(T0 + 15 * 60 * 1000);
    const cutoff = pool.query.mock.calls[0][1][1] as Date;
    expect(cutoff.getTime()).toBe(T0); // a row last active at T0 is not > cutoff, so it is refused
    expect(await service.resolve('staff_session=tok')).toEqual({ ok: false, reason: 'expired' });
    ```
    Web: `reason: 'expired'` renders "Your session ended after 15 minutes without activity."
  - |
    AC10 (14 minutes idle still opens). Same spec, with `jest.setSystemTime(T0 + 14 * 60 * 1000)` and the mock pool returning the row when `lastActivity > cutoff`:
    ```ts
    expect(await service.resolve('staff_session=tok')).toEqual({ ok: true, staff: { id: 's1', email: 'a@bank.example' } });
    expect(pool.query.mock.calls[0][0]).toContain('set last_activity_at = now()'); // activity slides the window
    ```
    A second resolve at T0 + 28 minutes, after a resolve at T0 + 14 minutes, also succeeds, which proves the window slides.
  - |
    Regression and data. A migration test (or e2e step) applies `005_staff.sql` twice and confirms it is idempotent and that existing `players` and `sessions` rows are untouched. The customer `SessionController` and `SignInForm` specs still pass with unchanged defaults. Narrow commands, run from the repo root:
    ```
    (cd services/api && pnpm run test -- src/staff)
    (cd apps/web && pnpm test -- src/app/back-office src/components/back-office src/lib/staffSession.test.ts)
    ```

assumptions_or_open_questions:
  - |
    The deferred question on credentials, sessions and lockout is answered in this plan. Staff are in separate tables with a separate cookie. Passwords use the existing scrypt `PasswordService`. Sessions use a sliding 15-minute idle timeout enforced server side. Lockout reuses `AttemptLimiter` (10 failures per IP and per email). Confirm the 10-failure limit is acceptable for staff.
  - |
    There is no "administrator" role in the app today, and the item scopes a single staff role. AC7 is therefore met by an operator-run script (`create-staff`) rather than an admin screen. If administrators should create staff from a web screen, that needs an admin role and is a separate item. Please confirm.
  - |
    Sessions have no absolute lifetime, only the 15-minute idle rule, because the item gives no cap. A stolen cookie that is kept active would stay valid. Confirm whether a maximum session length, for example 8 hours, is wanted.
  - |
    Expired staff session rows are not purged. They are inert (an expired row is refused) but accumulate. A cleanup job in `comp_background_worker` is left out as speculative. Say if wanted.
  - |
    The prototype's shell shows a "Home"-only nav on the back-office pages. The real root layout (`layout.tsx`) renders the customer-session nav (Menu and Lobby when signed out). This plan keeps the existing shell unchanged, and staff pages are not added to `MAIN_NAV`. A staff-specific top bar is left to a later item. Confirm.
  - |
    The refused-reason copy on the Access refused screen tells a customer "Customer accounts cannot open back-office pages." The prototype specifies that text, so it is kept. The sign-in screens use one identical refusal message for every cause. Note that the page-level reason can reveal that a customer session exists, but only to that same signed-in customer.
  - |
    Open project-wide questions not answerable here, and not affecting this item's build: retention of staff-action records (freezes and verification decisions), expected customer and transaction volumes, backup and recovery, and audit-data retention. This item stores no staff-action records. `staff_sessions` rows carry no audit meaning.
  - |
    The work item text contained no instructions outside the change itself, so nothing was excluded from this plan.

estimated_points: 8

package_dependencies: []

notes: |
  ### Data & rollout

  - **Existing data**: migration `005_staff.sql` only adds two new tables. It leaves `players`, `sessions` and every existing row untouched, so customers keep signing in as before.
  - **Backfill / seed**: no backfill. At least one staff account must exist before anyone can sign in. An operator runs `cd services/api && STAFF_EMAIL=... STAFF_PASSWORD=... pnpm run create-staff` (idempotent in effect, since a duplicate email is refused with a 409 and nothing is overwritten).
  - **Settings**: no new env vars for the app. `create-staff` reads `STAFF_EMAIL` and `STAFF_PASSWORD` at run time only. `SESSION_COOKIE_SECURE` and `DATABASE_URL` behave as today. The staff cookie reuses the same secure-cookie logic.
  - **Provisioning**: the first staff account, created by the script above.
  - **Order and rollback**: run `cd services/api && pnpm run migrate` before deploying the API and web code, because the new routes query the new tables. Rollback: the migration is additive and safe to leave in place. Manual down: `drop table staff_sessions, staff_accounts;`.

  Design tokens are loaded by `apps/web/src/app/globals.css` line 2 (`@import "../../../../design-system/tokens.css"`). The prototype's inlined tokens match.

  Prototype vs. acceptance criteria: no conflict found. The prototype shows the sign-in, register, home and refused screens for ACs 1 to 10. It also has prototype-only helpers (demo account buttons, session simulator) that are deliberately not built.

  ```mermaid
  flowchart TD
    Browser --> WebPages["apps/web back-office pages"]
    WebPages --> StaffLib["lib/staffSession.ts"]
    WebPages --> SignInForm["components/SignInForm.tsx"]
    StaffLib --> Rewrite["next.config.ts rewrite /staff/session"]
    Rewrite --> StaffCtl["staff.controller.ts"]
    StaffLib --> SessionLib["lib/session.ts getSession (customer check)"]
    StaffCtl --> StaffGuard["staff.guard.ts"]
    StaffCtl --> StaffSvc["staff.service.ts"]
    StaffCtl --> Limiter["session/attempt-limiter.service.ts"]
    StaffGuard --> StaffSess["staff-session.service.ts"]
    StaffSess --> SessionSvc["session/session.service.ts (shared helpers)"]
    StaffSvc --> Pwd["players/password.service.ts"]
    StaffSess --> DB[("staff_accounts, staff_sessions")]
    classDef touched fill:#f96,color:#000
    class WebPages,StaffLib,SignInForm,Rewrite,StaffCtl,StaffGuard,StaffSvc,StaffSess,SessionSvc,DB touched
  ```
  The new web pages and `staff.*` files are touched. `SignInForm` gains optional props. `next.config.ts` forwards `/staff/session/*`. `session.service.ts` only exports its token-hash helper. The limiter, the password service and `getSession` are reused as they are.

review_focus: |
  IN scope: separate staff tables, cookie, guard, sign-in/out, an always-refusing register endpoint, a sliding 15-minute idle rule, an operator script for creating staff, and the four prototype screens. OUT: any staff tools (freeze, identity review), an in-app admin role, a staff top bar, and retention or audit work. Riskiest area is `StaffSessionService.resolve`: the atomic update-and-cutoff query, the strict 15-minute boundary, and making sure no failure path resolves to staff. Deliberate choices: staff are NOT rows in `players` (customers can never authenticate there), and AC7 is met by a script because no admin role exists.
