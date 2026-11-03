summary: |
  HR keeps one standard onboarding template per job role: a list of tasks from pre-boarding to day 90, each with an owner (hiring manager, IT, new hire or HR) and a due date stored as a signed day offset from the start date (-N before, 0 start date, up to +90). The Records API (NestJS, PostgreSQL) gets a migration, an HR-only guard and an onboarding-templates module that validates and saves templates in one transaction. The Web App (Next.js) gets the approved screens: templates list, choose-a-role, template editor with a task drawer, and a read-only view for non-HR users. Saving a template only ever writes template rows, so plans already created for hires keep their tasks, owners and due dates (AC6). Creating hire plans is out of scope.
scope:
  - description: |
      Migration 004. (1) Add an account type to the existing users table: `alter table players add column if not exists account_role text not null default 'player' check (account_role in ('player','hr'))`. Existing rows become 'player'. (2) `onboarding_templates (id uuid pk default gen_random_uuid(), job_role text not null, created_at, updated_at)` with `create unique index onboarding_templates_role_uniq on onboarding_templates (job_role)` (AC11 is enforced by the database, like the appointments indexes). (3) `onboarding_template_tasks (id uuid pk, template_id uuid not null references onboarding_templates on delete cascade, position int not null, title text not null check (char_length(title) between 1 and 200), owner text not null check (owner in ('hiring_manager','it','new_hire','hr')), due_offset_days int not null check (due_offset_days <= 90))` (no lower bound: days before start are unlimited). (4) The minimal per-hire snapshot seam AC6 needs: `onboarding_plans (id, template_id uuid null references onboarding_templates on delete set null, job_role text not null, created_at)` and `onboarding_plan_tasks (id, plan_id references onboarding_plans on delete cascade, position, title, owner, due_offset_days)`. Plan tasks are COPIES by value, with no foreign key to template task rows, so editing or replacing template tasks cannot reach them. No code in this item inserts into them except test fixtures; the plan-creation story owns that.
    files:
      - services/api/migrations/004_onboarding_templates.sql
    rationale: |
      Follows migrations 001-003 (`create ... if not exists`, constraints in SQL, comment pointing at the code constants). The day-90 limit must match the constants in the service and web lib (pinned by a spec, as REASON_MAX is).
  - description: |
      Account type reaches the request. `Player` gains `accountRole: 'player' | 'hr'`; `SessionService.resolve` selects `p.account_role as "accountRole"`; `PlayersService.authenticate/register` return it (register always 'player'); `GET /session` returns `{ role: req.player.accountRole, email }` (today hard-coded `'player'`). Add `HrGuard` (runs after SessionGuard, throws ForbiddenException when `req.player.accountRole !== 'hr'`). The web `Session.role` already exists as a string.
    files:
      - services/api/src/players/players.service.ts
      - services/api/src/session/session.service.ts
      - services/api/src/session/session.controller.ts
      - services/api/src/session/session.guard.ts
      - services/api/src/session/hr.guard.ts
      - services/api/src/session/hr.guard.spec.ts
    rationale: |
      ADR-0010 (role-based access control) and ADR-0011 (built-in authentication) are accepted but the code has no HR concept today (read: `Player = { id; email }`, session returns role 'player'). Smallest change that lets the server, not the UI, decide who may write (AC12 is also enforced server side).
  - description: |
      Onboarding templates API module, mirroring `appointments/` (controller + service + module, `@UseGuards(SessionGuard)`). Routes, all behind SessionGuard; writes also behind HrGuard: `GET /onboarding-templates` (list of `{ role, taskCount, planCount }`), `GET /onboarding-templates/roles` (fixed job-role list, unused-first not needed), `GET /onboarding-templates/:role` (template with tasks ordered by due_offset_days then position; 404 unknown), `POST /onboarding-templates` (create, HR), `PUT /onboarding-templates/:role` (edit, HR). Service signature: `save(mode: 'create' | 'edit', role: string, tasks: TaskInput[]): Promise<SaveResult>` with `type TaskInput = { title: string; owner: Owner; dueOffsetDays: number | null }` and `type SaveRefusal = 'unknown_role' | 'no_tasks' | 'title_missing' | 'owner_missing' | 'due_missing' | 'due_too_late' | 'role_exists' | 'not_found'`. Validation is per task and returns `{ ok: false, code, taskIndex }`; controller maps it to 400 `{ code, taskIndex, message }` or 409 `{ code: 'role_exists', message }`. Create inserts template + tasks in one transaction and maps unique violation on `onboarding_templates_role_uniq` to `role_exists`. Edit runs in one transaction: lock template row, `delete from onboarding_template_tasks where template_id = $1`, re-insert, bump updated_at. It never touches `onboarding_plans` / `onboarding_plan_tasks`. Constants in `onboarding-templates.constants.ts`: `LATEST_DUE_DAY = 90` (no earliest limit), `OWNERS`, `JOB_ROLES`.
    files:
      - services/api/src/onboarding-templates/onboarding-templates.constants.ts
      - services/api/src/onboarding-templates/onboarding-templates.service.ts
      - services/api/src/onboarding-templates/onboarding-templates.controller.ts
      - services/api/src/onboarding-templates/onboarding-templates.module.ts
      - services/api/src/onboarding-templates/onboarding-templates.service.spec.ts
      - services/api/src/onboarding-templates/onboarding-templates.controller.spec.ts
      - services/api/src/app.module.ts
    rationale: |
      Same layering as appointments (controller maps typed refusals to HTTP; the database unique index decides duplicates so concurrent creates cannot both win). Error copy is the prototype's text, held in the controller like CONFLICT_MESSAGES.
  - description: |
      Web data layer `apps/web/src/lib/onboardingTemplates.ts`, mirroring `lib/appointments.ts`: types (`Owner`, `TemplateTask = { title; owner; direction: 'before' | 'after'; days }`), constants `LATEST_DUE_DAY = 90` (comment: keep in sync with the API constants and migration), pure helpers `dueLabel(task)` ("30 days before start", "Day 90 after start", "On the start date" - from the prototype's `dueLabel`), `toOffset/fromOffset` (direction + days <-> signed int), `validateTask(task)` returning `{ title?, owner?, due? }` messages (client-side mirror for inline errors), `sortTasks`, client calls `createTemplate(role, tasks)` / `updateTemplate(role, tasks)` returning a result union like `BookResult` (never throw), and server-side `getTemplates()`, `getTemplate(role)`, `getRoles()` using `next/headers` cookies via the same `getFromApi` pattern. Add `ONBOARDING_TEMPLATES_HREF = "/onboarding-templates"` to `lib/shell.ts` and append `{ key: "onboarding-templates", label: "Templates", href: ... }` to the END of `MAIN_NAV`; add the href to `NEXT_TARGETS`. Add rewrites `/api/onboarding-templates` and `/api/onboarding-templates/:path*` to `next.config.ts` (the page route is the same path, so the API goes under /api, as for appointments).
    files:
      - apps/web/src/lib/onboardingTemplates.ts
      - apps/web/src/lib/onboardingTemplates.test.ts
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/next.config.ts
    rationale: |
      UI guidelines: new sections go at the end of the nav. The design comment says "Templates" is added after Home; the real nav has more entries after Home, so it goes last (guideline wins; the visible position differs from the prototype's single-link shell).
  - description: |
      Pages (server components, each redirecting signed-out visitors to sign-in with `next`, as `app/appointments/page.tsx` does): `app/onboarding-templates/page.tsx` (list), `app/onboarding-templates/new/page.tsx` (HR only; non-HR redirected to the list), `app/onboarding-templates/[role]/page.tsx` (HR gets the editor, any other signed-in user gets the read-only view; `session.role === 'hr'` decides). `new` must be a static route so it is not captured by `[role]`; role slugs in URLs are the API slugs.
    files:
      - apps/web/src/app/onboarding-templates/page.tsx
      - apps/web/src/app/onboarding-templates/new/page.tsx
      - apps/web/src/app/onboarding-templates/[role]/page.tsx
      - apps/web/src/app/onboarding-templates/page.test.tsx
      - apps/web/src/app/onboarding-templates/[role]/page.test.tsx
    rationale: |
      Mirrors the existing page + page.test.tsx pairs. Non-HR gating is by session role from `getSession()`, with the API refusing writes regardless.
  - description: |
      Components in `apps/web/src/components/onboarding-templates/`, from the approved prototype. NEW (the prototype names them): `TemplateRoleRow` (a `.card` with role name, `.badge badge-neutral` task count, `.btn btn-secondary` "Edit" with `aria-label="Edit {role} template"` for HR; a "View" link instead for non-HR), `TemplateTaskRow` (`.card` row: task name, `.badge badge-info` owner, `.badge badge-neutral` due label, "Edit task" button only when editable), `TaskEditDrawer` (`.backdrop` + `.drawer.is-open` as a form with `aria-labelledby`, header title "Add task"/"Edit task" plus role `.badge badge-neutral`; body: Task `.input`, Owner fieldset of four `.radio`s (Hiring manager, IT, New hire, HR), "Due relative to start date" fieldset (Before start / After start, default After), Days `.input inputmode="numeric"` with hint "0 is the start date. The latest due date is day 90 after start."; footer Cancel `.btn-ghost`, Done `.btn-primary`; focus trap and Esc like `CartDrawer`; errors are `.field-error` with `role="alert"` plus `.is-invalid` on the input; first invalid control is focused). NEW composed screens: `TemplatesScreen` (list: `h1` "Onboarding templates", primary "New template" button HR only, muted intro, `.list` of rows, `.empty-state` "No templates yet" with one primary action for HR only), `NewTemplateForm` (Role `.select` with "Choose a role", inline `.field-error` for none chosen or "A template already exists for {role}. Edit it from the templates list instead.", Cancel / Continue; Continue first checks the loaded template list, and the API 409 is the backstop), `TemplateEditor` (title "{role} template", `.alert alert-info` "Plans already created from this template keep their tasks, owners and due dates..." shown when planCount > 0, `.alert alert-danger` "Add at least one task before saving." (focus moves to it), task list sorted by due offset, "Add task" `.btn-secondary`, Cancel `.btn-ghost` and one "Save template" `.btn-primary` that shows "Saving…" and is disabled while saving, then `router.push` to the list with the reused `Toast` "{role} template saved"; an API error shows an `.alert-danger`), `ReadOnlyTemplate` ("The standard checklist for this role. Only HR can change it." plus read-only `TemplateTaskRow`s, no create/edit controls, AC12). Reuse `Toast` (components/appointments/Toast.tsx) and `Icon` (components/orders/Icon.tsx); do not create a second toast or icon component. Tokens used, by name via the existing mapping: `--space-1/2/3/4`, `--radius-md/lg/sm`, `--color-border`, `--color-border-strong`, `--color-danger`, `--color-fg`, `--color-fg-muted`, `--color-focus`, `--size-drawer`, `--size-modal`, `--size-control`, `--border-width`, `--border-width-strong`, `--z-overlay`, `--z-modal`, `--font-size-sm`, `--font-weight-medium`. Single centred column at `--size-shell-max`; spacing between sections `stack stack-4`.
    files:
      - apps/web/src/components/onboarding-templates/TemplateRoleRow.tsx
      - apps/web/src/components/onboarding-templates/TemplateTaskRow.tsx
      - apps/web/src/components/onboarding-templates/TaskEditDrawer.tsx
      - apps/web/src/components/onboarding-templates/TemplatesScreen.tsx
      - apps/web/src/components/onboarding-templates/NewTemplateForm.tsx
      - apps/web/src/components/onboarding-templates/TemplateEditor.tsx
      - apps/web/src/components/onboarding-templates/ReadOnlyTemplate.tsx
      - apps/web/src/components/onboarding-templates/TaskEditDrawer.test.tsx
      - apps/web/src/components/onboarding-templates/TemplateEditor.test.tsx
      - apps/web/src/components/onboarding-templates/NewTemplateForm.test.tsx
      - apps/web/src/components/onboarding-templates/TemplatesScreen.test.tsx
      - apps/web/src/components/onboarding-templates/ReadOnlyTemplate.test.tsx
    rationale: |
      Matches the prototype's screens "Onboarding templates (HR)", "New template (choose role)", "Edit template (HR)", "Edit template task" and "Onboarding templates (not HR)". The design-system tokens are already loaded by apps/web/src/app/globals.css line 2 (`@import "../../../../design-system/tokens.css"`), so no loader work is needed. Deviation to note: the prototype renders the drawer inline as its own screen; production uses the fixed `.drawer` with `.backdrop` (the same pattern as `CartDrawer`), which is the guideline for secondary detail.
  - description: |
      CSS: in `apps/web/src/app/globals.css` add only the prototype utilities that are not already there (grep first): `.page-head`, `.row-between` (+ `.grow`), `.row-end`, `.list`, `.narrow`, `.task-meta`, `fieldset.field`, `.radio-line`; plus `.radio`/`.select`/`.badge-info` rules if missing. Copy them from the prototype with their token references, no literals.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      globals.css is where earlier screens copied their prototype CSS ("from design-system/prototype-utils.css and the approved prototype").
  - description: |
      End-to-end: a Playwright spec `apps/web/tests/e2e/onboarding-templates.spec.ts` covering the HR happy path and the non-HR read-only view, using the project's existing mock-session-server seam (extend `tests/e2e/mock-session-server.mjs` so an `e2e-hr=1` cookie yields `role: 'hr'` and serves the templates routes in memory). Playwright spec file only; run as the web e2e command already configured.
    files:
      - apps/web/tests/e2e/onboarding-templates.spec.ts
      - apps/web/tests/e2e/mock-session-server.mjs
    rationale: |
      The e2e suite stands the API in with a mock server (see the comment at the top of lib/session.ts), so the mock needs the new routes.
tests:
  - |
    AC1 (api service, jest, `cd services/api && pnpm run test -- onboarding-templates.service.spec.ts`). Write first, expect it to fail (no module):
    ```ts
    const res = await service.save('create', 'software-engineer', [task('Set up laptop', 'it', -3)]);
    expect(res).toEqual({ ok: true });
    expect((await service.get('software-engineer'))?.tasks).toHaveLength(1);
    ```
    Web: `TemplatesScreen.test.tsx` renders the saved role card, `expect(screen.getByText('Software engineer')).toBeInTheDocument()` and `expect(screen.getByText('1 task')).toBeInTheDocument()`; `TemplateEditor.test.tsx` fills a task in the drawer, clicks Done then "Save template" and asserts `createTemplate` was called with `('software-engineer', [expect.objectContaining({ title: 'Set up laptop' })])`.
  - |
    AC2: service spec edits one task and saves.
    ```ts
    await service.save('edit', 'software-engineer', [task('Set up laptop and badge', 'it', -3)]);
    expect((await service.get('software-engineer'))!.tasks[0].title).toBe('Set up laptop and badge');
    ```
    `TemplateEditor.test.tsx`: click "Edit task Set up laptop", change the title, Done, then `expect(screen.getByText('Set up laptop and badge')).toBeInTheDocument()` in the list before saving, and `updateTemplate` receives the edited title.
  - |
    AC3: `TaskEditDrawer.test.tsx` loops the four owners:
    ```ts
    for (const [label, value] of [['Hiring manager','hiring_manager'],['IT','it'],['New hire','new_hire'],['HR','hr']]) {
      await user.click(screen.getByRole('radio', { name: label }));
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(onDone).toHaveBeenLastCalledWith(expect.objectContaining({ owner: value }));
    }
    ```
    Plus `TemplateTaskRow` shows the owner `.badge` text ("IT"). Service spec: an owner outside the four is refused.
  - |
    AC4: pure helper test in `onboardingTemplates.test.ts` and a service test.
    ```ts
    expect(toOffset({ direction: 'before', days: 30 })).toBe(-30);
    expect(dueLabel({ direction: 'before', days: 30 })).toBe('30 days before start');
    ```
    Service: `save` with `dueOffsetDays: -30` then `get` returns `dueOffsetDays` `-30` (and the DB column holds -30).
  - |
    AC5: `expect(toOffset({ direction: 'after', days: 90 })).toBe(90); expect(dueLabel({ direction: 'after', days: 90 })).toBe('Day 90 after start');` Service: `dueOffsetDays: 90` saves and reads back as 90.
  - |
    AC6 (api service, real SQL against the test database used by the existing specs). Seed a template, copy its tasks into `onboarding_plans` / `onboarding_plan_tasks`, edit title, owner and offset on the template, then:
    ```ts
    const before = await planTasks(planId);
    await service.save('edit', 'software-engineer', [task('Changed', 'hr', 45)]);
    expect(await planTasks(planId)).toEqual(before);
    ```
    Also assert the editor note: `TemplateEditor.test.tsx` with `planCount: 14` shows `/keep their tasks, owners and due dates/`. If the repo's api specs mock `db.pool.query` instead of using a database, assert instead that `save('edit')` issues no SQL that mentions `onboarding_plans` or `onboarding_plan_tasks` (inspect `query.mock.calls`).
  - |
    AC7: `TaskEditDrawer.test.tsx` submits with a title and days but no owner:
    ```ts
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('alert', { name: '' })).toHaveTextContent('Choose an owner for this task.');
    expect(onDone).not.toHaveBeenCalled();
    ```
    Service: `owner: null` returns `{ ok: false, code: 'owner_missing', taskIndex: 0 }`; controller spec: 400 body `message` contains "owner" (use supertest on the controller).
  - |
    AC8: drawer with owner chosen and empty days: `expect(screen.getByText('Set a due date: enter the number of days, like 30.')).toBeVisible(); expect(screen.getByLabelText('Days')).toHaveAttribute('aria-invalid', 'true')` (or class `is-invalid`). Service: `dueOffsetDays: null` gives `due_missing`; a non-integer (1.5, "abc") also gives `due_missing`.
  - |
    AC9: drawer, choose After start and type 91, Done: `expect(screen.getByText('Day 90 is the latest allowed due date. Enter 90 or fewer.')).toBeVisible()`. Service: `dueOffsetDays: 91` gives `{ ok: false, code: 'due_too_late', taskIndex: 0 }`, 90 passes; controller returns 400 with `message` matching `/day 90 is the latest allowed/i`; the SQL check also rejects 91 (insert directly and expect a check violation).
  - |
    AC10: `TemplateEditor.test.tsx` with no tasks: click "Save template", `expect(screen.getByRole('alert')).toHaveTextContent('Add at least one task before saving.')`, `expect(createTemplate).not.toHaveBeenCalled()`, and focus is on the alert. Service: `save('create', role, [])` returns `{ ok: false, code: 'no_tasks' }` and no template row exists afterwards.
  - |
    AC11: service spec creates twice:
    ```ts
    await service.save('create', 'software-engineer', tasks);
    expect(await service.save('create', 'software-engineer', tasks)).toEqual({ ok: false, code: 'role_exists' });
    ```
    Controller spec: second POST returns 409 with `code: 'role_exists'`, and exactly one template remains. `NewTemplateForm.test.tsx`: choose an existing role, Continue, `expect(screen.getByText('A template already exists for Software engineer. Edit it from the templates list instead.')).toBeVisible()` and no navigation. Concurrency: two `Promise.all` creates give exactly one `ok: true`.
  - |
    AC12: web: `ReadOnlyTemplate.test.tsx` and `TemplatesScreen.test.tsx` with `isHr={false}`:
    ```ts
    expect(screen.queryByRole('button', { name: /new template|edit|add task|save template/i })).toBeNull();
    expect(screen.getByText('Set up laptop')).toBeInTheDocument();
    ```
    Page test for `[role]/page.tsx` with a session of `{ role: 'player' }` renders the read-only view, with `{ role: 'hr' }` renders the editor. API (server-side enforcement): `hr.guard.spec.ts` throws `ForbiddenException` for `accountRole: 'player'`; controller spec: a non-HR `POST` and `PUT` return 403 and write nothing, a non-HR `GET` returns 200, no cookie returns 401.
  - |
    Data and regression tests. Migration spec (or service spec against the migrated schema): a `players` row inserted before migration 004 reads back with `accountRole === 'player'` and can still sign in (existing session/players specs stay green). `shell.test.ts`: `MAIN_NAV.at(-1)` is the Templates entry and earlier entries keep their positions. E2E (Playwright, `pnpm exec playwright test onboarding-templates.spec.ts` from apps/web): HR creates a role template with one task and sees the saved toast; a non-HR session sees no "New template" or "Edit" buttons.
assumptions_or_open_questions:
  - |
    DECIDED by the reviewer. HR accounts - adding `players.account_role` (default 'player') with no promotion UI is accepted for now; HR rows are set in the database or by a seed, and admin management comes later.
  - |
    DECIDED by the reviewer. Job roles - a fixed code-based list as in the prototype (Software engineer, Customer support agent, Account manager) in `onboarding-templates.constants.ts`, until role management is introduced.
  - |
    AC6 needs hire plans to exist, but "creating hire plans" is excluded. The plan adds the minimal `onboarding_plans` / `onboarding_plan_tasks` snapshot tables (copies by value, no foreign key to template tasks) only so the guarantee can be tested and the editor can show the plan count. The plan-creation story should reuse or replace these tables. APPROVED by the reviewer, with one prerequisite: before implementation starts, align the final table and column names with the plan-creation story (open until then).
  - |
    DECIDED by the reviewer. Before start has no maximum; only days after start are capped at 90. Days must still be a whole number of 0 or more in the drawer.
  - |
    Editing a template replaces its task rows (delete and re-insert in one transaction). This is safe only because plans copy tasks and hold no foreign key to template tasks; a later story must not add one.
  - |
    Not asked of the work-item authors and still open from the project: how long completed onboarding plans and their task history are kept (PROD-28OCT-EPIC-043), and the expected number of concurrent hires and users (PROD-28OCT-CHORE-074; ADR-0006 says up to about 500 users). Neither changes this item: templates are tiny and no retention rule applies to them. The plan assumes no pagination of the template list.
  - |
    Day 0 and sorting. A task due on day 0 is shown as "On the start date". Tasks are shown ordered by due offset (earliest first), as in the prototype; two tasks with the same offset keep their entry order.
  - |
    Nav placement. The prototype shell shows only Home; the real top bar has more entries, so "Templates" is appended last per the UI guidelines. The link is shown to every signed-in user because non-HR users may view templates (AC12).
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: migration 004 adds `players.account_role text not null default 'player'` - a NOT NULL column WITH a default, so every existing player row becomes 'player' and stays readable and able to sign in; no row is rewritten by application code. The four new tables are empty. The check constraint and the unique index apply only to new tables, so no existing row can violate them.
  - **Backfill / seed**: no backfill. HR accounts need at least one row set to `account_role = 'hr'` (manual `update players set account_role = 'hr' where email = ...` or a seed); that statement is idempotent. No seed templates are required (the empty state handles none).
  - **Settings**: none. No new env var or config file.
  - **Provisioning**: at least one HR account must exist before anyone can create templates (see the open question); nothing else (no bucket, queue or flag).
  - **Order and rollback**: run `cd services/api && pnpm run migrate` (scripts/migrate.ts) before deploying the new API code, because `SessionService.resolve` selects `account_role`. Rollback: the migration is additive; leaving it in place is safe for old code. A manual down is `drop table onboarding_plan_tasks, onboarding_plans, onboarding_template_tasks, onboarding_templates; alter table players drop column account_role;`.

  ### Design reading

  Read in full: the prototype's screens "Onboarding templates (HR)" (list, empty state), "New template (choose role)", "Edit template (HR)" (info alert, zero-task danger alert, saving state, toast), "Edit template task" (drawer: Task, Owner radios, before/after radios, Days, field errors) and "Onboarding templates (not HR)". The prototype and the ACs agree. Two points differ from a literal copy: the nav position (see above) and the drawer being fixed with a backdrop instead of inline. Note also the prototype requires a task name (an extra `title-error`); the ACs do not mention it, but a task needs a name to be useful, so the plan keeps it (service code `title_missing`).

  ### Architecture

  ```mermaid
  flowchart TD
    Page["web pages onboarding-templates"] --> Lib["web lib/onboardingTemplates.ts"]
    Page --> Session["web lib/session.ts getSession"]
    Page --> Screens["web components onboarding-templates"]
    Screens --> Toast["components/appointments/Toast.tsx"]
    Lib --> Rewrite["next.config.ts rewrites /api/onboarding-templates"]
    Rewrite --> Ctl["api OnboardingTemplatesController"]
    Ctl --> SG["SessionGuard"]
    Ctl --> HG["HrGuard new"]
    Ctl --> Svc["OnboardingTemplatesService"]
    Svc --> DB["DatabaseService pool"]
    SG --> SS["SessionService.resolve"]
    SS --> DB
    DB --> Mig["migration 004"]
    Shell["web lib/shell.ts MAIN_NAV"] --> TopBar["TopBar.tsx"]
    classDef touched fill:#f96,color:#000
    class Page,Lib,Screens,Rewrite,Ctl,HG,Svc,SS,Mig,Shell touched
  ```

  Orange nodes are new or changed: the pages, lib and components are the new UI; `next.config.ts` carries the API rewrite; `HrGuard`, the controller and the service are the new API; `SessionService.resolve` now returns the account type; migration 004 owns the schema; `shell.ts` gets the nav entry.

  ### Other notes

  - The server is the authority for HR-only writes (HrGuard); hiding buttons in the UI is not the control.
  - Validation error codes carry `taskIndex` so the editor can reopen the offending task's drawer if the server refuses a save the client let through.
  - Test commands: narrow form of the project command, for example `cd services/api && pnpm run test -- onboarding-templates` and `cd apps/web && pnpm test -- onboarding-templates`. The full command is not run by this plan.
  - The work item and its parent text were treated as data; they contained no instructions unrelated to the change.
review_focus: |
  IN scope: HR-only create/edit of per-role templates (tasks, owner, signed due offset up to day 90), the read-only view for non-HR, nav entry, and the minimal schema; OUT: creating hire plans, progress tracking, HR provisioning UI. Riskiest parts: the edit transaction must never touch plan snapshot tables (AC6) and the HR check must be enforced server side (HrGuard), not just by hiding buttons. Deliberate choices a reviewer should not flag: replace-all-tasks on edit, the added `players.account_role` column and the minimal plan snapshot tables (flagged as open questions), no limit on days before start, Templates appended last in the nav, and a fixed drawer with backdrop instead of the prototype's inline drawer.
