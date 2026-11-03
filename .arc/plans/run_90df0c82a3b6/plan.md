summary: |
  Most of this story already exists from the earlier wallet stories. `wallet_entries` is an append-only ledger with `grant`, `bet`, `win` and `topup` rows, each carrying `balance_after_credits`. `PlayersService` writes the welcome bonus at registration. `WalletService.change()` updates the wallet and inserts the ledger row in one transaction. `historyFor` pages newest first, and `HistoryTable` shows kind, amount and balance after. The remaining gap is the open question about a bet and a win recorded at the same time. The ledger `created_at` defaults to `now()`, which is the transaction START time, so two concurrent transactions on one wallet can commit in one order while their timestamps say the other. "Newest first" would then disagree with the balance chain (AC5, AC6, AC7). This plan pins AC1-AC11 with tests (failing-first only where behaviour changes). It then makes ledger order follow the wallet row-lock order, using the `id` assigned at insert instead of `created_at`.
scope:
  - description: |
      Order history by `id desc` only. The bigserial is assigned at insert, after `update wallets` has taken the row lock, so id order equals lock order equals balance-chain order. Keep `created_at` for the 30-day `recent` filter and for display. Also insert ledger rows with `clock_timestamp()` so the displayed time is insert time, not transaction start.

      Before → after in `historyFor`:
      ```
      order by created_at desc, id desc  →  order by id desc
      ```
      Before → after in `change()` and in the registration grant insert:
      ```
      insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits) values ($1, $2, $3, $4)
      →
      insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits, created_at) values ($1, $2, $3, $4, clock_timestamp())
      ```
      The grant insert in `PlayersService` has the literal `'grant'` and `$2, $2`, so only add the `created_at` column and `clock_timestamp()` there.
    files:
      - services/api/src/wallet/wallet.service.ts
      - services/api/src/players/players.service.ts
    rationale: |
      Resolves the deferred question. The wallet row lock already serialises concurrent bet/win, and the balance and ledger row commit together. Only the sort key could disagree with the balance chain.
  - description: |
      Add migration `005_wallet_entries_id_idx.sql`. The number 004 is already taken by `004_onboarding_templates.sql`, and `scripts/migrate.ts` applies files in name order.
      ```sql
      create index if not exists wallet_entries_player_id_idx on wallet_entries (player_id, id desc);
      ```
      Additive and idempotent. Keep the existing `wallet_entries_player_created_idx`, which still serves the `recent` filter.
    files:
      - services/api/migrations/005_wallet_entries_id_idx.sql
    rationale: |
      The existing index is on (player_id, created_at desc, id desc) and no longer matches the sort. Without the new index the code still works, only slower.
  - description: |
      Test coverage for AC1-AC11 where the existing suites do not already pin them (see tests). No UI change is expected. `HistoryTable` already labels Welcome bonus, Bet, Win and Top-up with amount and balance, and `BalanceTile` reads the wallet balance. Reuse `HistoryTable` as is.
    files:
      - services/api/test/wallet.e2e-spec.ts
      - services/api/src/wallet/wallet.service.spec.ts
      - services/api/src/players/players.service.spec.ts
      - apps/web/src/components/history/HistoryTable.test.tsx
    rationale: |
      Proves the existing behaviour and the fix. Adds no speculative features.
tests:
  - |
    AC1 and AC9 (services/api/test/wallet.e2e-spec.ts). The existing "welcome bonus" test checks only the HTTP history; extend it to pin the last entry.
    ```ts
    const h = await service.historyFor(id, { page: 1, range: 'all' });
    expect(h.entries.at(-1)).toMatchObject({ kind: 'grant', amountCredits: 1000, balanceCredits: 1000 });
    ```
  - |
    AC2 and AC7 (e2e). Bet entry in history, with the amount and the balance after it.
    ```ts
    await service.placeBet(id, 10);
    const h = await service.historyFor(id, { page: 1, range: 'all' });
    expect(h.entries[0]).toMatchObject({ kind: 'bet', amountCredits: 10, balanceCredits: 990 });
    ```
  - |
    AC3 and AC8 (e2e). Win entry after a bet.
    ```ts
    await service.placeBet(id, 10);
    await service.recordWin(id, 50);
    expect((await service.historyFor(id, { page: 1, range: 'all' })).entries[0])
      .toMatchObject({ kind: 'win', amountCredits: 50, balanceCredits: 1040 });
    ```
  - |
    AC4 and AC10 (e2e). Top-up entry with its amount; seed the balance to 1 first.
    ```ts
    await seed(id, 1);
    await service.claimTopUp(id);
    expect((await service.historyFor(id, { page: 1, range: 'all' })).entries[0])
      .toMatchObject({ kind: 'topup', amountCredits: 500, balanceCredits: 501 });
    ```
  - |
    AC5 and AC6, the fix (e2e). FAIL first on `order by created_at desc, id desc`, PASS on `order by id desc`. Deterministic inversion, with no sleeps in production code. Hold the wallet row lock from a test client so the bet's transaction starts first and commits last.
    1. Open a `pool.connect()` client A, `begin`, and `update wallets set balance_credits = balance_credits where player_id = $1` (takes the lock).
    2. Start `const bet = service.placeBet(id, 10)`. Its transaction begins, its `now()` is fixed, and it blocks on the lock.
    3. Wait until the lock wait is visible (poll `pg_stat_activity` for `wait_event_type = 'Lock'`), then `commit` A.
    4. The bet commits after A, so the win must come from a transaction that started later but takes the lock first. To get that, start `recordWin` while A still holds the lock only if the lock queue grants it first. If it does not, instead insert the win's ledger row from a second test client started later, then verify the inversion with a precondition assert on timestamps.
    5. Repeat in a loop of about 20 pairs, truncating between loops.
    ```ts
    const h = await service.historyFor(id, { page: 1, range: 'all' });
    expect(h.entries[0].balanceCredits).toBe(await service.balanceFor(id));
    const chrono = [...h.entries].reverse();
    for (let i = 1; i < chrono.length; i++) {
      const delta = chrono[i].kind === 'bet' ? -chrono[i].amountCredits : chrono[i].amountCredits;
      expect(chrono[i].balanceCredits).toBe(chrono[i - 1].balanceCredits + delta);
    }
    ```
    Add a precondition assert that `created_at` order disagrees with `id` order in at least one iteration. The implementer may drop the loop to a single deterministic iteration if the precondition is guaranteed.
  - |
    Unit (services/api/src/wallet/wallet.service.spec.ts), written first and failing.
    ```ts
    expect(historySelectSql).toMatch(/order by id desc/);
    expect(historySelectSql).not.toMatch(/created_at desc/);
    expect(insertSql).toMatch(/clock_timestamp\(\)/);
    ```
    Unit (services/api/src/players/players.service.spec.ts): the grant insert (`sql[3]`) matches `/clock_timestamp\(\)/`.
  - |
    AC11 (e2e). Newest first, then older entries on later pages. The existing AC12/AC13 test only checks that the grant is last. Add:
    ```ts
    for (let i = 0; i < HISTORY_PAGE_SIZE + 3; i++) await service.recordWin(id, 1);
    const p1 = await service.historyFor(id, { page: 1, range: 'all' });
    const p2 = await service.historyFor(id, { page: 2, range: 'all' });
    expect(BigInt(p1.entries[0].id)).toBeGreaterThan(BigInt(p1.entries[1].id));
    expect(p1.entries).toHaveLength(HISTORY_PAGE_SIZE);
    expect(BigInt(p2.entries[0].id)).toBeLessThan(BigInt(p1.entries.at(-1)!.id));
    expect(p2.entries.at(-1)).toMatchObject({ kind: 'grant' });
    ```
  - |
    Existing e2e tests must still pass under `order by id desc`. The AC12/AC13 test inserts backdated rows with descending `created_at` as ids rise, and the grant (lowest id) is still last. Run it unchanged to confirm.
  - |
    Web (apps/web/src/components/history/HistoryTable.test.tsx), AC5 display. Render one entry of each kind (grant, bet, win, topup) and assert the labels and each row's balance cell.
    ```ts
    expect(screen.getByText('Welcome bonus')).toBeInTheDocument();
    ```
    First read the existing test and only add the cases it lacks.
  - |
    Migration 005 is idempotent (e2e, same pattern as the existing backfill test): run the file twice, expect no error, and expect existing entries to still read back.
    ```ts
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/005_wallet_entries_id_idx.sql'), 'utf8');
    await pool.query(sql);
    await pool.query(sql);
    expect((await service.historyFor(id, { page: 1, range: 'all' })).entries.length).toBeGreaterThan(0);
    ```
assumptions_or_open_questions:
  - |
    AC1-AC11 are largely satisfied by stories 053/056/065, so this item is verification plus the ordering fix. Reviewer decision, settled: keep BOTH the implementation (ordering, timestamp, index) and the tests in this story; do not reduce scope to tests only.
  - |
    The migration is numbered 005, not 004. `004_onboarding_templates.sql` already exists (checked in services/api/migrations), and `scripts/migrate.ts` applies files in name order.
  - |
    Ordering by `id` ignores `created_at`, so manually backdated rows (as in the existing e2e tests) sort by insertion order, not by their timestamp. This is deliberate. Real ledger rows only come from `change()` and the registration transaction, where id order is the balance-chain order.
  - |
    The deterministic bet/win inversion test depends on Postgres lock queue behaviour. If it cannot be made reliable, the implementer should fall back to a single deterministic case and tell the reviewer.
  - |
    Retention and backup of wallet transactions, audit record retention, and concurrent-player targets are project-wide questions that the code does not answer. They remain open and are not addressed here. The ledger is append-only and never deleted; `recent` only hides entries older than 30 days.
  - |
    `placeBet` and `recordWin` have no HTTP caller yet (the Play feature is later). They are tested through the service layer only.
  - |
    The work item and deferred-question text contained no instructions outside the change itself.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: no row changes. Migration 005 only adds an index. Existing `created_at` values are untouched, and old rows sort by `id`, which for real rows already follows insertion order.
  - **Backfill / seed**: none needed. `create index if not exists` is safe to re-run.
  - **Settings**: none.
  - **Provisioning**: none.
  - **Order and rollback**: apply migration 005 before or with the new code (`npm run` migrate script, `scripts/migrate.ts`). The code works without the index, only slower. Roll back by dropping the index and reverting the sort.

  Findings: `WalletService.change()` does a conditional UPDATE, which locks the wallet row, then inserts the ledger row, then commits, so the balance and the entry are always consistent. `balanceFor` reads `wallets.balance_credits`, which equals the latest entry's `balance_after_credits` by construction. No UI step, so no design-token work.

  ```mermaid
  flowchart TD
    Ctl[WalletController] --> Svc[WalletService: sort key and clock_timestamp]
    Players[PlayersService: grant insert timestamp] --> Ledger[(wallet_entries)]
    Svc --> Ledger
    Mig[005 migration: id index] --> Ledger
    Web[HistoryTable: test only] --> Ctl
    classDef touched fill:#f96,color:#000
    class Svc,Players,Mig touched
  ```
review_focus: |
  IN: the history sort key and ledger insert timestamp (answering the concurrent bet/win question), one additive index migration numbered 005, and tests for AC1-AC11. OUT: starting-balance and top-up rules, jackpot, any UI change, retention and backup. The riskiest part is the concurrency test, which must reliably make `created_at` order disagree with lock order. The `id`-based ordering is deliberate, not an oversight.
