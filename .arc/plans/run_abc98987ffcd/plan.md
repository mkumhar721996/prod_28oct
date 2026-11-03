summary: |
  Add per-hire onboarding plans. HR presses "Create plan" on a hire record and the Records API copies the hire's role template tasks (by value) into `onboarding_plan_tasks`, resolving each task's assignee: hiring-manager tasks go to the manager named on the hire record, IT tasks to "IT", HR tasks to "HR", new-hire tasks to the hire. Due dates are never stored: each plan task keeps its signed `due_offset_days` and the API returns `start_date + offset`, so changing the hire's start date moves every date at once. Creation is refused with a plain message when the hire has no manager (and the template has a hiring-manager task) or the role has no template. The Web App gets the two approved screens: the hire record (Create plan, refusal alert and toast) and the hire's plan (HirePlanTable, start-date save, "own copy" info alert, Done 0 of N tile).
scope:
  - description: |
      Migration `005_hires_and_plans.sql`. No hire record exists in the codebase today (searched `services/` and `apps/` for `hires`/`onboarding_plans`; only migration 004 defines `onboarding_plans`/`onboarding_plan_tasks`), so add the minimum hire record this story needs:
      ```sql
      create table if not exists hires (
        id uuid primary key default gen_random_uuid(),
        name text not null check (char_length(name) between 1 and 200),
        job_role text not null,
        start_date date not null,
        manager_name text,
        created_at timestamptz not null default now()
      );
      alter table onboarding_plans add column if not exists hire_id uuid references hires (id) on delete cascade;
      create unique index if not exists onboarding_plans_hire_uniq on onboarding_plans (hire_id) where hire_id is not null;
      alter table onboarding_plan_tasks add column if not exists assignee text;
      alter table onboarding_plan_tasks add column if not exists status text not null default 'not_started';
      ```
      Plan tasks keep NO foreign key to template tasks (migration 004 comment says never add one). `owner` keeps the template's owner key, `assignee` holds the resolved display name.
    files:
      - services/api/migrations/005_hires_and_plans.sql
    rationale: |
      The unique index on hire_id makes a second plan impossible even under concurrent presses. New columns are nullable or defaulted so any existing plan rows stay valid.
  - description: |
      New Nest module `hires` (controller, service, constants, module) registered in `app.module.ts`, all routes behind `SessionGuard` and `HrGuard`. Service signatures:
      ```ts
      export type Hire = { id: string; name: string; role: string; roleName: string; startDate: string; managerName: string | null; planId: string | null };
      export type PlanTask = { title: string; owner: Owner; assignee: string; dueOffsetDays: number; dueDate: string; status: 'not_started' };
      export type PlanView = { id: string; hireName: string; roleName: string; startDate: string; tasks: PlanTask[]; doneCount: number };
      export type CreatePlanResult = { ok: true; planId: string } | { ok: false; code: 'hire_not_found' | 'no_template' | 'no_manager' | 'plan_exists' };
      getHire(id: string): Promise<Hire | null>
      updateHire(id: string, patch: { startDate?: string; managerName?: string | null }): Promise<{ ok: true } | { ok: false; code: 'hire_not_found' | 'invalid_start_date' | 'unknown_manager' }>
      createPlan(hireId: string): Promise<CreatePlanResult>
      getPlan(hireId: string): Promise<PlanView | null>
      ```
      `createPlan` runs in one transaction: `select ... from hires where id = $1 for update`; refuse `plan_exists` if the hire has a plan; load the template by `job_role` (none, or zero tasks: `no_template`); if any task owner is `hiring_manager` and `manager_name` is null/blank: `no_manager`; insert one `onboarding_plans` row (`template_id`, `job_role`, `hire_id`) and every task row in one `insert ... select from unnest(...)` copying `position`, `title`, `owner`, `due_offset_days` and the resolved `assignee`. Assignee map: `hiring_manager` -> `hire.manager_name`, `it` -> `'IT'`, `hr` -> `'HR'`, `new_hire` -> `hire.name`. `getPlan` selects `to_char(h.start_date + t.due_offset_days, 'YYYY-MM-DD') as due_date` ordered by `due_offset_days, position`, so dates move with the start date. `updateHire` validates `startDate` as a real calendar date `YYYY-MM-DD` and `managerName` against `MANAGERS`.
      Routes: `GET /hires/managers`, `GET /hires/:id`, `PATCH /hires/:id`, `POST /hires/:id/plan` (201), `GET /hires/:id/plan` (404 when none). Refusals map to `UnprocessableEntityException({ code, message })` with these messages (taken from the approved prototype): `no_template` -> "Plan not created: the {role name} role has no onboarding template. Create the template first, then try again."; `no_manager` -> "Plan not created: this hire has no manager. Choose a manager on the hire record, then try again."; `plan_exists` -> 409; `hire_not_found` -> 404.
    files:
      - services/api/src/hires/hires.service.ts
      - services/api/src/hires/hires.controller.ts
      - services/api/src/hires/hires.module.ts
      - services/api/src/hires/hires.constants.ts
      - services/api/src/app.module.ts
    rationale: |
      Mirrors `onboarding-templates` (service owns SQL via `DatabaseService.pool`, controller maps refusal codes to HTTP errors, HR-only writes enforced on the server). Reads `onboarding_templates`/`onboarding_template_tasks` with SQL, so the template service and its edit path stay untouched: `save('edit')` never reads or writes plan tables, which is what keeps AC6 true.
  - description: |
      Web lib `apps/web/src/lib/hires.ts`, same split as `onboardingTemplates.ts`: client helpers (`createPlan`, `saveStartDate`, `saveManager`) call `/api/hires/...` with `credentials: "include"` and never throw; server helpers (`getHire`, `getPlan`, `getManagers`) forward the session cookie via `next/headers`. Pure helpers: `parseDate(text): string | null` (DD/MM/YYYY -> ISO, rejects 31/02), `toInputDate(iso)` (-> DD/MM/YYYY), `formatDate(iso)` (-> "1 November 2026", UTC, no timezone drift), `assigneeLabel`. Add `HIRES_HREF = "/hires"` to `shell.ts`. Add rewrites `/api/hires` and `/api/hires/:path*` in `next.config.ts` next to the template ones (line 16-19).
    files:
      - apps/web/src/lib/hires.ts
      - apps/web/src/lib/shell.ts
      - apps/web/next.config.ts
    rationale: |
      The browser must reach the API through the web origin so the session cookie goes along, the same way templates do.
  - description: |
      Pages `/hires/[id]` and `/hires/[id]/plan` (server components). Both redirect to sign-in when there is no session (same as `onboarding-templates/[role]/page.tsx`), `notFound()` for an unknown hire, and the plan page sends a hire with no plan back to the hire record. Components, per the approved prototype:
      - `HireRecordScreen` (new, `apps/web/src/components/hires/`): breadcrumbs "Hires / {name}", `h1` "Hire record", `.card` with name (h2), "Role: {role}", `.field` Start date (`.input`, placeholder DD/MM/YYYY, hint "Task due dates are counted from this date."), `.field` Manager (`.select`, first option "Choose manager"), then a row with a `.badge-neutral` "No plan yet" (becomes `.badge-success` "Plan created") and one `.btn-primary` "Create plan" (relabels "Creating plan…" and disabled while pending, becomes "View plan" once a plan exists). A refusal shows `.alert .alert-danger` (`role="alert"`, `i-alert` icon) with the API message, adds `.is-invalid` to the Manager select for `no_manager`, and raises the existing `Toast` (`components/appointments/Toast.tsx`) with "Plan not created". Success navigates to the plan page. The prototype's "Try another hire" chips are prototype-only and are NOT built.
      - `HirePlanScreen` (new): breadcrumbs "Hires / {name} / Plan", `h1` "{name}’s plan", ghost "Back to hire record" link, `.alert-info` "This plan is its own copy of the {role} template. Later template edits do not change it.", Start date `.field` + `.btn-secondary` "Save start date" (invalid text: `.is-invalid` + `.field-error` "Enter a start date like 08/12/2026."; saved: `.alert-success` "Start date saved as 8 December 2026. Every due date moved with it."), `HirePlanTable`, and a `.card` progress tile `Done` / `0 of N` with `role="img"` and `aria-label="Done: 0 of N tasks"`. The "Simulate HR template edit" chip is prototype-only and NOT built.
      - `HirePlanTable` (new, named in the prototype as the component later stories reuse): `.table-wrap` + `.plan-table` with caption "Tasks for {name}, earliest due date first", `th scope="col"` Task | Owner | Due date | Status; owner cell is `.badge-info` showing the assignee; due cell uses `formatDate`, `white-space: nowrap`, bolded briefly after a start-date save (`.moved`); status cell `.badge-neutral` "Not started". Owner labels reuse `ownerLabel` from `lib/onboardingTemplates.ts` only if needed; the assignee text itself comes from the API.
      Reused, not rebuilt: `Toast`, the `.card`/`.field`/`.input`/`.select`/`.alert-*`/`.badge-*`/`.btn-*` classes already in `globals.css`.
    files:
      - apps/web/src/app/hires/[id]/page.tsx
      - apps/web/src/app/hires/[id]/plan/page.tsx
      - apps/web/src/components/hires/HireRecordScreen.tsx
      - apps/web/src/components/hires/HirePlanScreen.tsx
      - apps/web/src/components/hires/HirePlanTable.tsx
    rationale: |
      Builds exactly the two approved screens. Single centred column, one primary button per view (Create plan; on the plan screen Save start date is secondary), sentence-case verb-first labels, status shown with a word on every badge, per the UI guidelines.
  - description: |
      Styles in `apps/web/src/app/globals.css` (tokens are already loaded by `@import "../../../../design-system/tokens.css"` at line 2, so no loader work is needed). Existing classes cover card, field, input, select, badge-info/neutral/success, alert-info/success/danger, btn-*, row-between, narrow and table-wrap. Add only: `.crumbs` and `.crumbs li + li::before` (font-size `--font-size-sm`, colour `--color-fg-muted`, gaps `--space-1`/`--space-2`), `.plan-table` (`--border-width`, `--color-border`, padding `--space-2`/`--space-3`, header fill `--color-bg-subtle`, header text `--color-fg-muted`, `--font-weight-medium`; `min-width: 34rem` is kept as a literal, as the prototype has it: the reviewer approved this until a design token exists), `.plan-table td.due.moved` (`--font-weight-semibold`), `.progress-tile` (gap `--space-2`, figure `--font-size-lg`). No colour or pixel literals.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      Copies the prototype's `<style>` block rules, expressed in tokens only. Mobile-first: the table sits in `.table-wrap` with horizontal scroll, as in the prototype.
tests:
  - |
    AC1 (api, `hires.service.spec.ts`, pool mocked like `onboarding-templates.service.spec.ts`). Write first; fails because `HiresService` does not exist:
    ```ts
    const result = await service.createPlan('hire-1');
    expect(result).toEqual({ ok: true, planId: 'plan-1' });
    const insert = client.query.mock.calls.find(([sql]) => /insert into onboarding_plan_tasks/.test(sql))!;
    expect(insert[1][2]).toHaveLength(templateTasks.length); // every template task is copied
    expect(insert[1][2]).toEqual(templateTasks.map((t) => t.title));
    ```
  - |
    AC2 (api, real SQL shape plus web). The plan view for start 2026-12-01 and offset -30 reports the due date, and the web formatter prints it in full:
    ```ts
    expect(plan.tasks[0]).toMatchObject({ dueOffsetDays: -30, dueDate: '2026-11-01' });
    // hires.test.ts
    expect(formatDate('2026-11-01')).toBe('1 November 2026');
    ```
    The API spec also asserts `getPlan` SQL contains `h.start_date + t.due_offset_days` (the date is computed, never stored) and that no `due_date` column is inserted.
  - |
    AC3 (api): hire `{ name: 'Alex Morgan', managerName: 'Dana Lee' }`, template with a `hiring_manager` task:
    ```ts
    expect(insertedAssignees).toEqual(['Dana Lee']);
    ```
    Web: `HirePlanTable.test.tsx` renders `{ assignee: 'Dana Lee' }` and `expect(screen.getByText('Dana Lee')).toBeInTheDocument()`.
  - |
    AC4 (api): template with an `it` task: `expect(insertedAssignees).toEqual(['IT'])`.
  - |
    AC5 (api + web). API: `updateHire('hire-1', { startDate: '2026-12-08' })` issues `update hires set start_date = $2` and touches no `onboarding_plan_tasks` row (`expect(client.query.mock.calls.some(([s]) => /update onboarding_plan_tasks/.test(s))).toBe(false)`), and a `getPlan` after the change returns `dueDate: '2026-11-08'` for offset -30. It also refuses `'2026-02-31'` with `invalid_start_date`. Web: `HirePlanScreen.test.tsx` types `08/12/2026` into Start date, clicks "Save start date" and `expect(await screen.findByText('8 November 2026')).toBeInTheDocument()` and `Start date saved as 8 December 2026. Every due date moved with it.`; typing `31/02/2026` shows `Enter a start date like 08/12/2026.` and sends nothing.
  - |
    AC6 (api): plan tasks are copies. Assert the insert SQL names `title, owner, due_offset_days` columns with values, includes no template-task id, and `migrations/005` plus `004` contain no `references onboarding_template_tasks`. Extend the existing `never touches the hire plan tables (AC6)` test so it still passes. With a real-database spec if the repo has one, otherwise mock-based: after `createPlan`, calling `OnboardingTemplatesService.save('edit', ...)` on the same pool issues no SQL mentioning `onboarding_plan_tasks`, and `getPlan` returns the original `title`, `assignee` and `dueDate` values from the copied rows. Web: `HirePlanScreen` shows the info alert `This plan is its own copy of the Software engineer template. Later template edits do not change it.`
  - |
    AC7 (api + web). API: hire with `managerName: null`, template with a `hiring_manager` task:
    ```ts
    expect(await service.createPlan('hire-1')).toEqual({ ok: false, code: 'no_manager' });
    expect(client.query).toHaveBeenCalledWith('rollback');
    expect(insertCalls).toHaveLength(0);
    ```
    Controller spec: `await expect(controller.createPlan('hire-1')).rejects.toMatchObject({ response: { code: 'no_manager', message: expect.stringContaining('this hire has no manager') } })`. Also a case where the template has NO hiring-manager task and the hire has no manager: plan is created. Web: `HireRecordScreen.test.tsx` with the create call returning `{ ok: false, kind: 'no_manager', message }` shows `screen.getByRole('alert')` with that message, the Manager select has class `is-invalid`, and the toast reads `Plan not created`.
  - |
    AC8 (api + web): role with no template row (and a template row with zero tasks):
    ```ts
    expect(await service.createPlan('hire-2')).toEqual({ ok: false, code: 'no_template' });
    ```
    Controller maps it to 422 with a message containing `has no onboarding template`. Web: the alert shows `Plan not created: the Account manager role has no onboarding template. Create the template first, then try again.`
  - |
    AC9 (api): template with a `new_hire` task, hire named Alex Morgan: `expect(insertedAssignees).toEqual(['Alex Morgan'])`.
  - |
    AC10 (api): template with an `hr` task: `expect(insertedAssignees).toEqual(['HR'])`.
  - |
    Guards and idempotency (api): `POST /hires/:id/plan` by a non-HR player is 403 (same pattern as `hr.guard.spec.ts`); a second create for the same hire returns `plan_exists` (409) and a unique violation on `onboarding_plans_hire_uniq` is mapped to `plan_exists` too, like `role_exists` in the template service.
  - |
    Migration (api, in `hires.service.spec.ts`, mirroring the constants-vs-SQL check at the bottom of `onboarding-templates.service.spec.ts`): read `migrations/005_hires_and_plans.sql` and assert it adds `hire_id`, `assignee` and `status` with `if not exists`, defines `onboarding_plans_hire_uniq`, and adds no NOT NULL column without a default to `onboarding_plans` or `onboarding_plan_tasks`, so rows written before it stay readable.
assumptions_or_open_questions:
  - |
    There is no hire record, hires list or hire-creation feature in the codebase (looked in `services/api/src`, `services/api/migrations`, `apps/web/src/app`). This plan adds the minimal `hires` table and read/patch API the acceptance criteria need ("the manager on the hire record", "start date changes"). Who creates hires, and with what data, is not covered here; for tests and manual checks the implementer inserts rows with SQL. DECIDED by the reviewer: adding the minimal hires table is approved.
  - |
    The manager is stored as a name (`manager_name`), because the AC says "names manager Dana Lee" and there is no user or employee table. The prototype's Manager select offers only Dana Lee, so the plan assumes a code constant `MANAGERS` in `hires.constants.ts` (like `JOB_ROLES`) seeded with Dana Lee until user management exists. DECIDED by the reviewer: approved.
  - |
    The assignee is copied onto the plan task when the plan is created. If the hire's manager is changed later, existing plan tasks keep the old name: no AC covers it, so it is out of scope. DECIDED by the reviewer: a later manager change does not update existing plans or tasks.
  - |
    IT and HR assignees are stored as the plain role labels `IT` and `HR` (no role/user tables exist yet), matching the prototype's owner badges.
  - |
    Refusal order: role-without-template is checked before missing manager (the prototype does the same), and a missing manager only refuses when the template has a hiring-manager task (AC7 wording). A hire can have one plan; a second create is refused with 409 rather than replacing it.
  - |
    The prototype notes the "Hires" nav item is not in the shell. The plan adds no nav entry (the UI guidelines list only Home and a hires list page does not exist), so the pages are reached by URL `/hires/{id}` until a hires list story adds the link.
  - |
    DECIDED by the reviewer: keep the prototype's `min-width: 34rem` on `.plan-table` as a literal, since no token covers it. Replace it with a token when one is introduced.
  - |
    Agreed by the reviewer as project-level and not affecting this story. Deferred project-wide questions (retention of completed plans and history; concurrent hires and users). Neither changes this item: plans are small rows, nothing here deletes or archives them, and ADR-0006 puts scale at about 500 users, so no pagination is planned. They stay open for the project.
  - |
    Dates are plain calendar dates (Postgres `date`, ISO strings over the API, formatted in UTC in the browser), so there is no timezone shift. Start-date input is DD/MM/YYYY as in the prototype.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: migration `005_hires_and_plans.sql` adds a new `hires` table and three columns on tables from migration 004. `onboarding_plans.hire_id` is nullable, `onboarding_plan_tasks.assignee` is nullable, and `status` has a default of `not_started`, so any plan rows that exist stay readable; the unique index is partial (`where hire_id is not null`). Nothing in the app wrote those tables before this story.
  - **Backfill / seed**: none needed. No hire data is seeded; the migration is idempotent (`if not exists` throughout) and safe to re-run.
  - **Settings**: none. No env var or config change beyond the two `next.config.ts` rewrites.
  - **Provisioning**: the feature needs hire rows (inserted by SQL until a hire-creation story exists), at least one HR account (`players.account_role = 'hr'`, already set in the database per migration 004), and a template for the hire's role.
  - **Order and rollback**: run the API migration command used for 004 (`cd services/api && pnpm run migrate`; implementer confirms the script) before deploying the new API code, since the plan queries read the new columns. Rollback: additive, so leaving it in place is safe for old code; manual down is `alter table onboarding_plan_tasks drop column assignee, drop column status; drop index onboarding_plans_hire_uniq; alter table onboarding_plans drop column hire_id; drop table hires;`.

  ### Design and tokens
  Built from the approved prototype `PROD-28OCT-STORY-076-design.html` (two screens: Hire record, Hire's plan). Tokens are loaded in `apps/web/src/app/globals.css:2` (`@import "../../../../design-system/tokens.css"`); every new rule uses token names only. The prototype does not conflict with any AC. The one wording difference: AC7/AC8 ask for a message that the hire has no manager / the role has no template, and the prototype's message text does say that.

  ### Why due dates are computed, not stored
  AC5 says dates move with the start date, and AC6 says template edits do not. Storing the template's offset on the plan task and deriving the date from `hires.start_date` gives both with no update step and no chance of drift. The `hire_id` unique index plus `for update` on the hire row serialise concurrent "Create plan" presses.

  ```mermaid
  flowchart TD
    UI[HireRecordScreen / HirePlanScreen / HirePlanTable]:::touched -->|fetch /api/hires| RW[next.config.ts rewrites]:::touched
    UI --> LIB[lib/hires.ts]:::touched
    RW --> CTRL[HiresController]:::touched
    CTRL --> GUARDS[SessionGuard + HrGuard]
    CTRL --> SVC[HiresService]:::touched
    SVC --> DB[(DatabaseService.pool)]
    DB --> M5[005_hires_and_plans.sql]:::touched
    DB --> M4[004 templates and plan tables]
    TSVC[OnboardingTemplatesService.save edit]
    TSVC -. never reads or writes plan tables .-> M4
    APP[app.module.ts]:::touched --> CTRL
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN: hires table, plan creation with assignee resolution and the two refusals, computed due dates, start-date change, and the two approved screens (no prototype-only chips, no nav entry, no status editing, no row actions). OUT: hire creation/listing, reassigning on manager change, template changes, retention. Riskiest: the create-plan transaction (unique index, `for update`, refusal ordering) and keeping plan tasks free of any link to template tasks so AC6 holds. Deliberate: dates are derived from `hires.start_date + due_offset_days` rather than stored, and `MANAGERS` is a code constant until user management exists, the manager is copied at creation and never re-synced, and `.plan-table` keeps the prototype's literal `min-width: 34rem` (reviewer-approved).
