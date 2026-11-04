summary: |
  Let signed-in staff find one customer account in the back office, freeze it with a required reason, and unfreeze it. A frozen account refuses transfers from and to it. Nothing else changes: the customer's other accounts still transfer and sign-in still succeeds. The Records API gets an `accounts` table (with freeze state plus a freeze/unfreeze audit trail), a StaffGuard-protected accounts controller, and a minimal customer transfer operation, because the codebase has no customer accounts or transfers yet (only one credits wallet per player) and ACs 4, 5 and 7 cannot be tested without one. The Web App replaces the placeholder in BackOfficeHome with the approved two-column accounts screen: search left, account panel right, with default, freeze-error, frozen, unfrozen, loading, empty, error and customer-refused states.
scope:
  - description: |
      Migration `006_accounts_freeze.sql`, idempotent like 001 to 005 (`create ... if not exists`):
      ```sql
      create table if not exists accounts (
        id uuid primary key default gen_random_uuid(),
        player_id uuid not null references players (id),
        number text not null unique,
        balance_credits bigint not null default 0 check (balance_credits >= 0),
        frozen_at timestamptz,
        frozen_by uuid references staff_accounts (id),
        freeze_reason text,
        created_at timestamptz not null default now(),
        check ((frozen_at is null) = (freeze_reason is null))
      );
      create table if not exists account_freeze_events (
        id bigserial primary key,
        account_id uuid not null references accounts (id),
        staff_id uuid not null references staff_accounts (id),
        action text not null check (action in ('freeze', 'unfreeze')),
        reason text,
        created_at timestamptz not null default now()
      );
      ```
      Backfill: one `accounts` row per existing player that has none (`insert ... select ... where not exists`), balance 0, number generated from a sequence as `ACC-` plus digits. Safe to re-run.
    files:
      - services/api/migrations/006_accounts_freeze.sql
    rationale: |
      Freeze state lives on the account itself so one row lock decides both "is it frozen" and "may money move". The events table is the record of staff actions (who, when, why) the deferred question asks about.
  - description: |
      New Nest module `accounts` in the Records API.
      `AccountsService` (uses DatabaseService.pool like WalletService):
      ```ts
      export type FreezeResult = { ok: true; account: AccountView } | { ok: false; reason: 'reason_required' | 'not_found' | 'already_frozen' };
      search(query: string): Promise<AccountView[]>            // name/email or number, capped list
      get(id: string): Promise<AccountView | null>
      freeze(accountId: string, staffId: string, reason: unknown): Promise<FreezeResult>
      unfreeze(accountId: string, staffId: string): Promise<FreezeResult>
      ```
      `freeze` trims `reason`, refuses a blank or non-string value before touching the database (AC1), then in one transaction does `update accounts set frozen_at = now(), frozen_by = $2, freeze_reason = $3 where id = $1 and frozen_at is null returning ...` plus an `account_freeze_events` insert. `unfreeze` needs no reason (any signed-in staff member, AC3) and clears the three columns plus writes an event.
      `AccountsController` at `staff/accounts`, `@UseGuards(StaffGuard)` on the whole class: `GET ?q=`, `GET :id`, `POST :id/freeze` (body `{ reason }`, 400 `{ code: 'reason_required', message }` when blank), `POST :id/unfreeze`. A customer cookie fails StaffGuard with 401, which is the AC8 refusal. Register `AccountsModule` in app.module.ts, importing StaffModule for the guard.
    files:
      - services/api/src/accounts/accounts.module.ts
      - services/api/src/accounts/accounts.service.ts
      - services/api/src/accounts/accounts.controller.ts
      - services/api/src/accounts/accounts.constants.ts
      - services/api/src/app.module.ts
    rationale: |
      Mirrors the staff module: guard-in-controller, SQL in the service, constants in their own file, so the single "staff or refused" decision stays in StaffGuard.
  - description: |
      Minimal transfer between two accounts, so ACs 4, 5 and 7 are real behaviour: `TransfersService.transfer(playerId, fromId, toId, amount)` behind `POST /transfers` with SessionGuard (the customer must own the source account). One transaction: `select ... from accounts where id = any($1) order by id for update` locks both rows in a fixed order (no deadlock); refuse with `account_frozen` if either has `frozen_at`; refuse `insufficient_balance`; otherwise move the balance. A freeze that commits first makes the transfer refuse; a transfer that committed first is settled, and the freeze takes effect for every later one. This answers the deferred question on in-flight transactions.
    files:
      - services/api/src/transfers/transfers.module.ts
      - services/api/src/transfers/transfers.service.ts
      - services/api/src/transfers/transfers.controller.ts
      - services/api/src/app.module.ts
    rationale: |
      The enforcement point has to be the same transaction that moves money, otherwise a freeze can race a transfer. The scope is deliberately the smallest transfer that can honour the ACs (see open questions: no transfer UI, no history).
  - description: |
      Web App: add `lib/staffAccounts.ts` (types plus `searchAccounts`, `freezeAccount`, `unfreezeAccount`, calling `/api/staff/accounts` with credentials, following lib/onboardingTemplates.ts and lib/staffSession.ts) and a rewrite in next.config.ts for `/api/staff/accounts` and `/api/staff/accounts/:path*` to the API. Add `components/back-office/AccountsScreen.tsx` (search column with a `.field` and `.input` labelled "Find an account", the result list, the panel) and a small `AccountPanel.tsx` for the swap between Active (freeze form), Frozen (reason, who, when, Unfreeze account button) and the unfrozen `.alert-success` confirmation. Reuse `Icon` and `Toast`. In BackOfficeHome.tsx keep the sign-out toolbar and replace the placeholder empty-state card with `<AccountsScreen />`; keep the `Back-office tools` placeholder wording only for the verification review that is a different story. Copy is taken from the design: "Reason for freeze (required)", "Enter a reason to freeze this account. The account has not been frozen." (`.is-invalid` on the `.textarea` with `aria-invalid` and `aria-describedby`, `.field-error` with the alert icon, `role="alert"`), "Account ACC-2218 is unfrozen. Transfers are allowed again.", "No accounts match ...", "The accounts could not be loaded. Check your connection and try again." with a "Try again" `.btn-secondary`. The customer-refused state is the existing AccessRefused screen from `app/back-office/page.tsx`, so no new refusal UI is built.
    files:
      - apps/web/src/lib/staffAccounts.ts
      - apps/web/next.config.ts
      - apps/web/src/components/back-office/AccountsScreen.tsx
      - apps/web/src/components/back-office/AccountPanel.tsx
      - apps/web/src/components/back-office/BackOfficeHome.tsx
    rationale: |
      Builds the approved prototype using the existing back-office page, which already decides staff-or-refused on the server.
  - description: |
      Styles in the app's own stylesheet, on tokens only. globals.css already defines .stack, .stack-2, .stack-4, .card, .field, .input, .textarea, .is-invalid, .field-error, .btn-primary, .badge-success, .badge-danger, .alert-success, .alert-danger, .empty-state, .skeleton and .toolbar (the `.toolbar` rule there has no wrap or gap, extend it to match the prototype). Add the prototype-only classes that globals.css does not define, copied from the design's own `<style>` block: .workspace, .search-col, .detail-col, .result-list, .result (with `[aria-current="true"]`), .panel-head, .form-actions, .row-inline. Tokens used: --space-1/2/3/4, --size-drawer, --size-control-lg, --color-border, --color-primary, --color-primary-bg, --color-bg-subtle, --color-focus, --border-width, --border-width-strong, --size-focus-offset, --radius-md, --color-fg, --color-fg-muted. No colour or pixel literals. Confirm the Frozen badge's `.badge-danger` and `.btn-secondary` exist in globals.css before using them and add them on the same tokens if not.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      The design system tokens are already loaded by globals.css; only the screen-specific layout classes are missing.
tests:
  - |
    AC1, refused with no reason. API unit (accounts.service.spec.ts) and e2e (test/accounts.e2e-spec.ts) written first.
    ```ts
    const res = await request(app.getHttpServer()).post(`/staff/accounts/${id}/freeze`).set('Cookie', staffCookie).send({ reason: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('reason_required');
    expect((await accounts.get(id))?.frozen).toBe(false);
    ```
    Web: AccountsScreen.test.tsx submits an empty textarea, expects `screen.getByRole('alert')` to have the text "Enter a reason to freeze this account. The account has not been frozen.", the textarea `aria-invalid="true"`, and `freezeAccount` not called.
  - |
    AC2, freeze with a reason.
    ```ts
    const res = await freeze(id, { reason: 'Suspected card fraud' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ frozen: true, freezeReason: 'Suspected card fraud' });
    expect(await eventCount(id, 'freeze')).toBe(1);
    ```
    Other accounts are untouched: `expect((await accounts.get(otherId))?.frozen).toBe(false)`. Web test: with a reason typed, clicking "Freeze account" shows the Frozen badge and "Unfreeze account".
  - |
    AC3, any staff member unfreezes. Freeze as staff A, unfreeze as a second staff member B.
    ```ts
    const res = await request(app.getHttpServer()).post(`/staff/accounts/${id}/unfreeze`).set('Cookie', staffBCookie);
    expect(res.status).toBe(201);
    expect(res.body.frozen).toBe(false);
    ```
    Web test: clicking "Unfreeze account" shows the alert "Account ACC-2218 is unfrozen. Transfers are allowed again.".
  - |
    AC4, transfer from a frozen account is refused. Both an e2e test and a service test.
    ```ts
    await freezeAccount(fromId);
    const res = await transfer(customerCookie, { fromId, toId, amount: 10 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('account_frozen');
    expect(await balanceOf(fromId)).toBe(before);
    ```
  - |
    AC5, transfer to a frozen account is refused: same as AC4 but with `toId` frozen, and `expect(await balanceOf(fromId)).toBe(before)`. A concurrency test runs a transfer and a freeze with `Promise.all`: either the transfer committed first (balance moved, freeze applied) or it was refused, and the balances are never half-moved.
  - |
    AC6, sign-in succeeds for a customer with a frozen account (session.e2e-spec.ts addition).
    ```ts
    await freezeAccount(customerAccountId);
    const res = await request(app.getHttpServer()).post('/session/sign-in').send(credentials);
    expect(res.status).toBe(200);
    ```
  - |
    AC7, two accounts, one frozen, transfer from the other succeeds. Source account and a third account are open, the customer's other account is frozen and not involved.
    ```ts
    const res = await transfer(customerCookie, { fromId: openA, toId: openB, amount: 10 });
    expect(res.status).toBe(201);
    expect(await balanceOf(openA)).toBe(before - 10);
    ```
  - |
    AC8, a signed-in customer cannot freeze. A customer session cookie is sent to the staff endpoints.
    ```ts
    const res = await request(app.getHttpServer()).post(`/staff/accounts/${id}/freeze`).set('Cookie', customerCookie).send({ reason: 'x' });
    expect(res.status).toBe(401);
    expect((await accounts.get(id))?.frozen).toBe(false);
    ```
    Also the same for `/unfreeze` and `GET /staff/accounts`. Web: the existing `app/back-office/page.test.tsx` already covers the customer-refused screen, so add one assertion that `AccountsScreen` is not rendered for it.
  - |
    Migration: existing rows stay usable. Seed a player (with wallet) before applying 006, apply it twice (read through `fs.readFileSync` as wallet.e2e-spec.ts does for 002), then `expect(accountsFor(playerId)).toHaveLength(1)` and `expect(account.frozen_at).toBeNull()`.
  - |
    Web states from the design: loading shows `.skeleton` with `aria-busy`, no match shows the empty state with "Clear search", and a failed search shows `.alert-danger` with "Try again" that re-runs the search. Run narrow forms such as `cd services/api && pnpm run test -- accounts` and `cd apps/web && pnpm test -- AccountsScreen`.
assumptions_or_open_questions:
  - |
    The repo has no customer bank accounts and no transfers: there is only one `wallets` credits balance per player and a staff table. The plan therefore creates a minimal `accounts` table and `POST /transfers` so ACs 4, 5 and 7 are testable. This is larger than the story text implies; confirm that it is wanted here, or that a separate transfer story should land first and this one should then only add the freeze check to it.
  - |
    Is a customer account the same thing as the existing `wallets` row (game credits)? The plan assumes not, and does not touch wallets or the lobby and history screens. If the answer is yes, accounts should be built on `wallets` and `placeBet` and `claimTopUp` would also need the freeze check.
  - |
    "Open customer account" is treated as any account that exists: there is no closed state in this plan. The backfill gives each existing player one account with balance 0, which is an invention; confirm the expected opening balances.
  - |
    Retention of freeze and unfreeze records, transaction and audit data, expected volume, and backup and recovery are all open project-wide questions (EPIC-058, CHORE-094). The plan keeps `account_freeze_events` indefinitely with no purge job. At roughly 500 users (ADR-0006) one table and a lock per transfer are fine.
  - |
    No transfer screen is built (no AC asks for one), so the customer-facing result of a refused transfer is only the API's 409 `account_frozen` code.
  - |
    Search matches by customer email or account number with a capped result list, since accounts have no name field. The design shows names such as "Amara Okafor"; players only have an email today. Confirm whether a display name is wanted, which would add a column.
  - |
    Unfreeze needs no reason or confirm, as the design states. Staff identity (who froze, when) is shown from `frozen_by`, using the staff email since staff have no display name.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: 006 only adds new tables. No existing table or column changes. Existing players get one backfilled `accounts` row (balance 0, unfrozen), so nobody is locked out and nothing existing is rewritten.
  - **Backfill / seed**: the backfill is an `insert ... where not exists` inside 006, idempotent and safe to re-run. It is a small table scan (about 500 users, ADR-0006), so no long lock. There is no staff seed: staff accounts already exist from 005 and `services/api/src/staff/create-staff.ts`.
  - **Settings**: none. No new env var or config file.
  - **Provisioning**: staff accounts must exist to use the tool (already how STORY-110 works). Nothing else.
  - **Order and rollback**: run `cd services/api && DATABASE_URL=... pnpm run migrate` (README "Database migrations") before deploying the new API code, because the new code reads `accounts`. Rollback: leave the tables in place (the old code ignores them), or drop `account_freeze_events` then `accounts`. The web change is safe to deploy after the API.

  Design source: the approved prototype's screen "Back-office accounts" (staff strip with Sign out, `.workspace` with `.search-col` and `.detail-col`). It is a single-column stack on narrow screens through flex-wrap. No conflict with the ACs found; the prototype's sample accounts and its "Priya" toast are prototype shortcuts and are not carried into code. Tokens are already loaded through apps/web/src/app/globals.css (design tokens as CSS variables).

  Stack: NestJS plus PostgreSQL with jest and supertest (comp_records_api), Next.js with Tailwind, vitest and playwright (comp_web_app). No new packages.

  ```mermaid
  flowchart TD
    Page[app/back-office/page.tsx] --> Home[BackOfficeHome.tsx]
    Home --> Screen[AccountsScreen.tsx]
    Screen --> Lib[lib/staffAccounts.ts]
    Lib --> Rewrite[next.config.ts rewrites]
    Rewrite --> Ctl[accounts.controller.ts]
    Ctl --> Guard[staff.guard.ts]
    Ctl --> Svc[accounts.service.ts]
    Xfer[transfers.service.ts] --> DB[(accounts table 006)]
    Svc --> DB
    Svc --> Events[(account_freeze_events)]
    classDef touched fill:#f96,color:#000
    class Home,Screen,Lib,Rewrite,Ctl,Svc,Xfer,DB,Events touched
  ```
  Touched: BackOfficeHome swaps its placeholder for the screen; the lib and rewrite carry the staff cookie to the API; the controller reuses StaffGuard unchanged; the service and transfers service share the row lock that makes a freeze and a transfer serialise.
review_focus: |
  Hold the work to: staff freeze (reason required) and unfreeze of one account, refusal of transfers from or to a frozen account, and nothing else (no transfer UI, no account creation, no verification review). The riskiest part is the transfer-versus-freeze race: both must lock account rows with `for update` in a fixed order inside one transaction. The accounts and transfers tables and endpoint are new because the repo had neither, which is flagged as an open question and is deliberate; a customer reaching the staff endpoints is refused by the existing StaffGuard, not by new code.
