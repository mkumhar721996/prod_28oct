summary: |
  Let a signed-in customer move simulated money between their own checking and savings accounts: pick from/to account and an amount, review a summary, confirm. Nothing in the repo models bank accounts yet (only `players` and the credits `wallets`), so this story builds the whole slice. That is a migration for `accounts`, `transfers` and `audit_records` in the Records API, plus a shared transfer rule engine that the later payee-payment story reuses. The engine is instant, refuses a low balance or a frozen source or destination before any money moves, never double-debits or double-credits (row locks plus a per-confirmation idempotency key), and writes an audit record in the same transaction. The Web App gets a `/transfer` page that follows the approved prototype: form, review, success, refused and frozen states, with balances updated in place and no toast or alert beyond the on-page message.
scope:
  - description: |
      Migration `006_bank_accounts.sql` (idempotent, `create ... if not exists`, like 001-005). Tables:
      `accounts(id uuid pk default gen_random_uuid(), player_id uuid not null references players(id), kind text not null check (kind in ('checking','savings')), balance bigint not null default 0 check (balance >= 0), frozen boolean not null default false, unique (player_id, kind))`;
      `transfers(id uuid pk, player_id, from_account_id, to_account_id, amount bigint not null check (amount >= 1), check (from_account_id <> to_account_id), idempotency_key text not null, created_at timestamptz default now(), unique (player_id, idempotency_key))`;
      `audit_records(id bigserial pk, kind text not null, player_id uuid, transfer_id uuid references transfers(id), details jsonb not null, created_at timestamptz default now())`, append-only and never deleted.
      Backfill: `insert ... select` one checking and one savings row per existing player `where not exists`, so re-running is safe.
    files:
      - services/api/migrations/006_bank_accounts.sql
    rationale: |
      The data the screens show does not exist yet. The unique key makes a repeated confirmation a no-op at the database level.
  - description: |
      Accounts module in the Records API (`services/api/src/accounts/`), modelled on `wallet.*`: `accounts.constants.ts`, `accounts.service.ts`, `transfers.service.ts`, `accounts.controller.ts`, `accounts.module.ts`, imported in `app.module.ts`.
      Endpoints, both behind `SessionGuard` with the player id taken from the session only, never from the body:
      `GET /accounts` returns `[{ id, kind, balance, frozen }]`.
      `POST /transfers` takes `{ fromAccountId, toAccountId, amount, idempotencyKey }` and returns 200 `{ transferId, reference, from: {id, balance}, to: {id, balance}, replayed }`. A refusal is a 409 `{ message, reason }`.
      Shared rule engine (the one the payee story reuses):
      ```ts
      export type TransferRefusal =
        | 'invalid_amount' | 'same_account' | 'insufficient_balance' | 'source_frozen' | 'destination_frozen' | 'not_found';
      export type TransferResult =
        | { ok: true; transferId: string; from: AccountBalance; to: AccountBalance; replayed: boolean }
        | { ok: false; reason: TransferRefusal };
      execute(playerId: string, input: { fromAccountId: string; toAccountId: string; amount: unknown; idempotencyKey: unknown }): Promise<TransferResult>
      ```
      Order inside ONE transaction:
      1. Validate the amount as a safe integer >= 1 and the key as a non-empty string of at most 100 characters.
      2. `insert into transfers ... on conflict (player_id, idempotency_key) do nothing returning id`. If no row comes back, return the stored outcome with `replayed: true` and change nothing.
      3. `select ... from accounts where id = any($1) and player_id = $2 order by id for update`. Locking in id order means concurrent transfers serialise and cannot deadlock. This answers the open question on simultaneous transfers.
      4. Check, in order: both accounts exist and are the player's (else `not_found`), source frozen, destination frozen, balance >= amount. On a refusal, roll back, which also removes the transfers row, so a refused attempt is retryable with the same key after the cause is fixed.
      5. Two `update accounts set balance = balance +/- $amount`, then `insert into audit_records (kind, player_id, transfer_id, details) values ('transfer.completed', ...)`, then commit.
      Refusal messages live in the constants file, are plain and start "Transfer not made." (for example "Transfer not made. Checking does not have 150 available. Enter 100 or less." and "Transfer not made. Savings is frozen, so money cannot move in or out.").
    files:
      - services/api/src/accounts/accounts.constants.ts
      - services/api/src/accounts/accounts.service.ts
      - services/api/src/accounts/transfers.service.ts
      - services/api/src/accounts/accounts.controller.ts
      - services/api/src/accounts/accounts.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Epic decision: a transfer that cannot go through is refused before any money moves, a frozen account is blocked as both source and destination, and there is no extra alert. The row lock, the idempotency key and the single transaction cover the no-double-debit and audit criteria.
  - description: |
      Open a customer's checking and savings accounts at registration, in the same transaction that creates the player and wallet in `PlayersService.register`, with an opening balance constant (see open questions). New row inserts only, with no change to the existing wallet code.
    files:
      - services/api/src/players/players.service.ts
      - services/api/src/players/players.constants.ts
    rationale: |
      A new customer must have both accounts, or the Transfer page has nothing to show. Migration 006 covers existing players.
  - description: |
      Web data layer. `apps/web/src/lib/accounts.ts`:
      `getAccounts(): Promise<Account[]>` (server side, cookies forwarded, `cache: 'no-store'`, same pattern as `getWallet` in `lib/session.ts`);
      `submitTransfer(input): Promise<TransferOutcome>` (client side, POST `/api/transfers`, never throws, returns `{ ok: true, from, to } | { ok: false, reason, message }`);
      `newIdempotencyKey()` using `crypto.randomUUID()`.
      Add the rewrite `{ source: '/api/transfers', destination: `${apiUrl}/transfers` }` in `next.config.ts`, because `/transfer` is the page itself and the existing rewrites follow the same convention.
      Append `TRANSFER_HREF = '/transfer'`, a `transfer` entry at the END of `MAIN_NAV` (label "Transfer") and a `NEXT_TARGETS` entry in `lib/shell.ts`.
    files:
      - apps/web/src/lib/accounts.ts
      - apps/web/src/lib/shell.ts
      - apps/web/next.config.ts
    rationale: |
      The browser must reach the API through the web origin with the session cookie. New sections go at the end of the nav so existing positions stay stable (UI guidelines).
  - description: |
      UI, built from the approved prototype `PROD-28OCT-STORY-104-design.html` (screen "Transfer between accounts", states default, review, success, refused, frozen).
      `apps/web/src/app/transfer/page.tsx` is a server component. It calls `getSession()` and redirects to sign-in when signed out (as `wallet/page.tsx` does), calls `getAccounts()`, and renders the `<h1>` "Transfer between your accounts", the muted line "Move money between your checking and savings accounts. Transfers are instant." and `<TransferScreen accounts={...} />`. Add `apps/web/src/app/transfer/loading.tsx` with `.skeleton` blocks, as `wallet/loading.tsx` does.
      `apps/web/src/components/transfer/TransferScreen.tsx` is a client component with a state machine (`form | review | success | refused`) and the idempotency key. It uses these classes, all already defined in `globals.css`: `.card .stack`, `.field`, `.select`, `.input`, `.field-hint`, `.field-error` with `.is-invalid`, `.btn-primary`, `.btn-secondary`, `.alert-success`, `.alert-danger`, `.alert-warning` and `.badge-warning`.
      - Form: a "From account" select, a "To account" select and an "Amount" input with `inputmode="decimal"`. Each account option reads "Checking (balance 200)". The hint reads "Enter an amount up to the balance of the from account." The one `.btn-primary` is "Continue". Client validation (same account, amount not a positive whole number) shows `.field-error` text, not colour alone.
      - Review: `<h2>` "Review your transfer", a `.card` with three summary rows (From, To, Amount) and the note "Nothing moves until you confirm. Checking 200 and Savings 100 stay as they are." Buttons are secondary "Edit" and primary "Confirm transfer". Confirm is disabled and reads "Confirming…" while pending, which absorbs a double click; the same idempotency key is kept for the whole review.
      - Success: `.alert-success` with `role="status"` ("Transfer complete. 50 moved from Checking to Savings."), a two-card pair of balance tiles (150 and 200, `aria-live="polite"`) taken from the response with no reload, and the reference line. Primary button "Make another transfer".
      - Refused (low balance): `.alert-danger` with `role="alert"` and the server's "Transfer not made. ..." text, both balances unchanged, and the secondary button "Change the amount".
      - Frozen (source or destination): `.alert-warning` with `role="alert"`, a `.badge-warning` "Frozen" next to the affected account, and the secondary button "Change the accounts".
      - No toast, `window.alert` or `Notification` is used anywhere (AC 9). A network failure shows a plain `.alert-danger`: "Couldn't make the transfer. Try again."
      Extend `BalanceTile` (existing, reused as the prototype's `data-component`) with optional `label`, `amount` (plain number, no currency, per the prototype) and `frozen` props. The credits wallet usage and `BalanceTile.test.tsx` stay unchanged.
      `globals.css` gets a "Transfer" block on tokens only, with these classes (none exist yet): `.pair` (grid, `gap: var(--space-3)`, `minmax(min(var(--size-grid-min), 100%), 1fr)`), `.bal-label`, `.bal-value` (`--font-size-xl`, `--font-weight-semibold`, `--line-height-tight`), `.summary-row` (`--space-2` padding, `--border-width` `--color-border` divider) and `.actions-between` (space-between). Sections are separated with `.stack-4` and inputs get the 44px touch height as in the prototype via `var(--size-control-lg)`, the nearest token. Tokens are already loaded by `@import "../../../../design-system/tokens.css"` at `apps/web/src/app/globals.css:2`.
    files:
      - apps/web/src/app/transfer/page.tsx
      - apps/web/src/app/transfer/loading.tsx
      - apps/web/src/components/transfer/TransferScreen.tsx
      - apps/web/src/components/BalanceTile.tsx
      - apps/web/src/app/globals.css
    rationale: |
      This is the approved design. It reuses BalanceTile and the existing form, alert, badge and button classes instead of adding components.
  - description: |
      Extend the e2e mock server `apps/web/tests/e2e/mock-session-server.mjs` with in-memory `/accounts` and `/transfers` handlers (same rules, so the Playwright flow runs without PostgreSQL) and add `apps/web/tests/e2e/transfer.spec.ts`.
    files:
      - apps/web/tests/e2e/mock-session-server.mjs
      - apps/web/tests/e2e/transfer.spec.ts
    rationale: |
      Playwright is the confirmed web e2e tool, and the existing specs use this mock seam.
tests:
  - |
    AC1, `apps/web/src/components/transfer/TransferScreen.test.tsx` (vitest, written first). Choosing checking to savings with amount 50 and clicking Continue shows the review rows and calls no API:
    ```ts
    await user.type(screen.getByLabelText('Amount'), '50');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Review your transfer' })).toBeVisible();
    expect(within(screen.getByTestId('review-summary')).getByText('Checking')).toBeVisible();
    expect(within(screen.getByTestId('review-summary')).getByText('Savings')).toBeVisible();
    expect(within(screen.getByTestId('review-summary')).getByText('50')).toBeVisible();
    expect(submitTransfer).not.toHaveBeenCalled();
    ```
  - |
    AC2. Same file: clicking Edit, or unmounting the screen from the review state, never calls `submitTransfer`, and the form still shows both balances unchanged:
    ```ts
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(submitTransfer).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: 'Checking (balance 200)' })).toBeInTheDocument();
    ```
    Playwright: open review, navigate away, then reload `/transfer` and assert balances 200 and 100.
  - |
    AC3 and AC4. In `TransferScreen.test.tsx`, a mocked `submitTransfer` resolving `{ ok: true, from: { balance: 150 }, to: { balance: 200 } }` makes Confirm render both balances with no reload:
    ```ts
    await user.click(screen.getByRole('button', { name: 'Confirm transfer' }));
    expect(await screen.findByText('150')).toBeVisible();
    expect(screen.getByText('200')).toBeVisible();
    ```
    In `services/api/src/accounts/transfers.service.spec.ts` (against the migrated test DB, as in `wallet.service.spec.ts`), with checking 200 and savings 100:
    ```ts
    const r = await transfers.execute(playerId, { fromAccountId: checking, toAccountId: savings, amount: 50, idempotencyKey: 'k1' });
    expect(r).toMatchObject({ ok: true, from: { balance: 150 }, to: { balance: 200 } });
    ```
    Add a `supertest` case in `services/api/test/transfers.e2e-spec.ts` for `POST /transfers` returning 200 and a following `GET /accounts` returning 150 and 200.
  - |
    AC5. API spec: checking 100, transfer 150, so `expect(r).toEqual({ ok: false, reason: 'insufficient_balance' })`. The e2e test expects 409 with `message` matching `/^Transfer not made\./`. UI test: a refusal outcome renders `screen.getByRole('alert')` with text `Transfer not made.` and the screen offers "Change the amount".
  - |
    AC6. API spec, a table test over the three refusal causes (amount above balance, source frozen via `update accounts set frozen = true`, destination frozen). After each, re-read both rows:
    ```ts
    expect(await balances(checking, savings)).toEqual({ checking: 200, savings: 100 });
    expect(await count('transfers')).toBe(0);
    expect(await count('audit_records')).toBe(0);
    ```
    UI test: the refused and frozen states show the unchanged balances returned by `GET /accounts` (the mock returns none changed).
  - |
    AC7. API spec: with checking frozen, `expect(r).toEqual({ ok: false, reason: 'source_frozen' })`. UI test: the frozen outcome renders `getByRole('alert')` containing "Transfer not made." with a "Frozen" badge on Checking. Playwright covers the same through the mock server.
  - |
    AC8. API spec: with savings frozen, `expect(r).toEqual({ ok: false, reason: 'destination_frozen' })`. UI test: the frozen outcome shows a "Frozen" badge on Savings and the text "Transfer not made.".
  - |
    AC9. UI test: after a refusal, `expect(screen.queryByRole('status')).not.toBeInTheDocument()` (no toast or success message), `vi.spyOn(window, 'alert')` is never called, and the `Toast` component is not rendered. The only message is the one `role="alert"` block. The page renders no toast container.
  - |
    AC10 and AC11. API spec, same key twice and sequentially:
    ```ts
    const input = { fromAccountId: checking, toAccountId: savings, amount: 50, idempotencyKey: 'same' };
    const first = await transfers.execute(playerId, input);
    const second = await transfers.execute(playerId, input);
    expect(second).toMatchObject({ ok: true, replayed: true, from: { balance: 150 }, to: { balance: 150 + 50 } });
    expect(await balanceOf(checking)).toBe(150);
    expect(await balanceOf(savings)).toBe(150);
    ```
    Concurrency (the open question): fire `Promise.all` with 5 transfers of 50 from a checking balance of 100 using distinct keys and expect exactly 2 to succeed and a final balance of 0, never negative. A second case sends the same key 5 times concurrently and expects one debit. UI test: a double click on Confirm calls `submitTransfer` once, and a re-submit reuses the same key.
  - |
    AC12. API spec: after a successful transfer
    ```ts
    const { rows } = await pool.query("select kind, player_id, transfer_id, details from audit_records");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'transfer.completed', player_id: playerId });
    expect(rows[0].details).toMatchObject({ from: checking, to: savings, amount: 50 });
    ```
    A replay leaves the count at 1, and a rolled-back transfer (the audit insert forced to fail) leaves the balances unchanged.
  - |
    Existing data. A migration test, following `003_appointments` and `004_onboarding_templates`: seed a player with a wallet, apply `006_bank_accounts.sql` twice, and assert exactly one checking and one savings account for that player, with the wallet and `wallet_entries` untouched. Add `players.service.spec.ts` coverage that `register` creates both accounts, and the guard tests that `GET /accounts` and `POST /transfers` return 401 when signed out. A player cannot transfer using another player's account id (`not_found`).
  - |
    Shell. Update `apps/web/src/components/TopBar.test.tsx` to pin that "Transfer" is the LAST entry of the signed-in nav, and that signed-out visitors do not see it.
assumptions_or_open_questions:
  - |
    Opening balances. The story gives no source for money in the accounts (the criteria assume 200 and 100). I assumed new and backfilled accounts open at a constant `OPENING_BALANCE` that defaults to 0, so a real customer cannot move money until someone decides how simulated funds arrive (seeded demo balance, deposit story, or conversion of the credits wallet). Please decide before code is written.
  - |
    Freezing. No story here lets staff freeze or unfreeze an account, so `accounts.frozen` is set directly in the database and read by the transfer rules. A back-office freeze control is out of scope for this story.
  - |
    Amounts are whole units (no cents), stored as `bigint` and shown as plain numbers with no currency, matching the criteria (50, 150) and the prototype. Decimal amounts and a currency are not in the story; a non-whole amount gets a field error. Confirm this is acceptable.
  - |
    Audit scope. The story requires an audit record only for a completed transfer (AC 12), so refused attempts are not audited. Say if refusals should be recorded too. Retention of audit records is an open project-wide question (how long audit data and transaction records are kept, plus backup and recovery expectations); no retention or purge job is planned, and rows are append-only.
  - |
    Serialisation answer (deferred question). Concurrent transfers lock both account rows with `select ... for update` in id order inside one transaction, with `check (balance >= 0)` as a database backstop. At the stated scale (about 500 users) this needs no queue or the Background Worker.
  - |
    Idempotency model. The browser creates one key per review/confirm attempt, and the server stores it with the transfer, unique per player. A repeat returns the original outcome rather than an error. A refused attempt stores nothing, so the same key can be retried after the cause is fixed. The key is not kept for refused attempts.
  - |
    The prototype shows the transfer column at 560px, but no token covers that width. The plan uses the existing `.narrow` width (`--size-modal`, 480px) rather than a literal, and the same goes for the prototype's 44px control height, which uses `--size-control-lg` (48px). Say if you want a new token added.
  - |
    The prototype shows the frozen state with a combined message for either account. The plan shows the specific account (source or destination) with its Frozen badge, since the API returns `source_frozen` or `destination_frozen`. The criteria require only a plain message that the transfer was not made.
  - |
    The UI guidelines say the only top-bar destination is Home, but the shipped nav already holds eight entries, so a Transfer entry is appended at the end, as the rule on new sections says.
  - |
    "Recorded in your activity history" in the prototype's success text is not delivered: there is no activity-history feature for these accounts in this story, so the plan shows only the reference ("Reference TRF-..." built from the transfer) and not that sentence. Payees are a separate story and are not planned here.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: `006_bank_accounts.sql` only adds tables. No existing table is altered, so players, wallets, sessions and `wallet_entries` are unaffected. The backfill adds one checking and one savings account per existing player with the `OPENING_BALANCE` default (0).
  - **Backfill / seed**: the backfill is `insert ... select ... where not exists` against `unique (player_id, kind)`, so it is idempotent and safe to re-run. The tables are new and small, so no long lock is held.
  - **Settings**: none required. `OPENING_BALANCE` is a code constant in `players.constants.ts` (default 0), not an env var.
  - **Provisioning**: run `cd services/api && DATABASE_URL=... pnpm run migrate` (`scripts/migrate.ts` applies `migrations/*.sql` in name order) before the new API code starts. Nothing else is needed (no queue, bucket or flag).
  - **Order and rollback**: deploy order is migrate, then API, then web. The new tables are unused by older code, so rolling the code back is safe and the tables can stay. A full revert drops `audit_records`, `transfers` and `accounts`, in that order. Do not drop them once real transfers exist, because the audit data must be kept.

  ### Context
  - Reuses: `DatabaseService.pool` (the transaction pattern in `WalletService.change`), `SessionGuard` and `PlayerRequest`, `BalanceTile`, and the existing `.card`, `.field`, `.select`, `.input`, `.alert-*`, `.badge-warning` and `.btn-*` classes in `globals.css`.
  - The accounts are separate from the credits wallet (`wallets`, `wallet_entries`), which stays as it is. "Customer" means the existing signed-in player; there is no separate customer model.
  - The shared transfer rules live in `TransfersService.execute` over account ids, so the payee payment story can call it (or a sibling that resolves a payee to a destination account) without a second rule set.

  ```mermaid
  flowchart TD
    Page[apps/web transfer/page.tsx] --> Screen[TransferScreen]
    Screen --> Tile[BalanceTile]
    Screen --> WebLib[lib/accounts.ts]
    Page --> WebLib
    WebLib -->|"/api/transfers rewrite"| Cfg[next.config.ts]
    Cfg --> Ctl[accounts.controller.ts]
    Ctl --> Guard[SessionGuard]
    Ctl --> Svc[TransfersService]
    Ctl --> Acc[AccountsService]
    Svc --> Db[DatabaseService pool]
    Acc --> Db
    Players[players.service.ts register] --> Db
    Db --> Mig[006_bank_accounts.sql]
    Nav[lib/shell.ts MAIN_NAV] --> Page
    classDef touched fill:#f96,color:#000
    class Page,Screen,Tile,WebLib,Cfg,Ctl,Svc,Acc,Players,Mig,Nav touched
  ```
  The edges show who calls whom. Touched nodes: the page and screen (the approved design), BalanceTile (an optional label, amount and frozen), `lib/accounts.ts` (fetch and submit), `next.config.ts` (the rewrite), the controller, the two services and the migration (the new feature), `PlayersService.register` (to open accounts), and `shell.ts` (the nav entry).

  Nothing in the work item or deferred questions asked for credentials, outside files, URLs or disabling checks, so nothing was refused.
review_focus: |
  IN: accounts, transfers and audit tables; the shared transfer engine and its two endpoints; the `/transfer` page with all five prototype states; the nav entry. OUT: payees, external, bill and scheduled payments, staff freeze controls, deposits and funding, retention jobs. The riskiest part is `TransfersService.execute`: the lock order, the idempotency insert before the checks, and rolling back everything on refusal, so check it against the concurrency and replay tests. The deliberate choices are that opening balances default to 0 (an open question), that refused attempts are not audited or stored, and that the balance shown after success comes from the server response rather than client arithmetic.
