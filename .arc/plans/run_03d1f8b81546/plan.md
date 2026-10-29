summary: |
  Most of this story is already built by the earlier wallet stories (053, 056, 065): `wallet_entries` is an append-only ledger with `grant`, `bet`, `win` and `topup` rows each carrying `balance_after_credits`; `PlayersService` writes the welcome bonus in the registration transaction; `WalletService.change()` updates the wallet and inserts the ledger row in one transaction; `historyFor` pages newest first; `HistoryTable` shows kind, amount and balance after. The remaining real gap is the open question about a bet and a win recorded at the same time. The ledger's `created_at` defaults to `now()`, which is the transaction START time, so two concurrent transactions on one wallet can commit in one order while their timestamps say the other, and "newest first" would then disagree with the balance chain (AC5, AC6, AC7). The plan pins every AC with a test, then makes the ledger order follow the row-lock order (the `id` assigned at insert, after the wallet row lock) rather than `created_at`.
scope:
  - description: |
      Order history by `id desc` only (the bigserial is assigned at insert, after `update wallets` has taken the row lock, so id order equals commit order equals balance-chain order). Keep `created_at` for the 30-day `recent` filter and display.
      Before → after in `historyFor`:
      `order by created_at desc, id desc` → `order by id desc`
      Also insert ledger rows with `clock_timestamp()` instead of the default `now()` in `change()` and in the registration grant, so displayed times are insert time, not transaction start.
    files:
      - services/api/src/wallet/wallet.service.ts
      - services/api/src/players/players.service.ts
    rationale: |
      Resolves the deferred question: the wallet row lock already serialises concurrent bet/win and the balance and ledger row commit together; only the sort key could disagree.
  - description: |
      Add migration `004_wallet_entries_order_idx.sql`: `create index if not exists wallet_entries_player_id_idx on wallet_entries (player_id, id desc);` so the new ordering stays indexed. Additive, idempotent.
    files:
      - services/api/migrations/004_wallet_entries_order_idx.sql
    rationale: The existing index is on (player_id, created_at desc, id desc) and no longer matches the sort.
  - description: |
      Test-only coverage for ACs 1-7 where the existing suites do not already pin them (see tests). No UI change is expected: `HistoryTable` already shows Welcome bonus, Bet, Win, Top-up with amount and balance, and `BalanceTile` reads the wallet balance.
    files:
      - services/api/test/wallet.e2e-spec.ts
      - services/api/src/wallet/wallet.service.spec.ts
      - apps/web/src/components/history/HistoryTable.test.tsx
    rationale: Proves the existing behaviour and the fix; adds no speculative features.
tests:
  - |
    AC1 (services/api/test/wallet.e2e-spec.ts, check existing first): register, then fetch history.
    `expect(h.entries.at(-1)).toMatchObject({ kind: 'grant', amountCredits: 1000, balanceCredits: 1000 })`
  - |
    AC2: after `placeBet(id, 10)`, `expect(h.entries[0]).toMatchObject({ kind: 'bet', amountCredits: 10, balanceCredits: 990 })`
  - |
    AC3: after a bet then `recordWin(id, 50)`, `expect(h.entries[0]).toMatchObject({ kind: 'win', amountCredits: 50, balanceCredits: 1040 })`
  - |
    AC4: drain the balance to 1, `claimTopUp`, then `expect(h.entries[0]).toMatchObject({ kind: 'topup', amountCredits: 500 })`
  - |
    AC5 and AC6 (fails first, FAIL-then-PASS for the fix): fire a bet and a win concurrently, then
    `const h = await wallet.historyFor(id, { page: 1, range: 'all' });`
    `expect(h.entries[0].balanceCredits).toBe(await wallet.balanceFor(id));`
    and walk the entries oldest to newest asserting each `balanceCredits` equals the previous plus or minus its amount. Run it in a loop of ~20 pairs with the bet's transaction delayed (e.g. `pg_sleep` via a test hook or by holding the row lock) so `created_at` ordering inverts; it fails on `order by created_at desc` and passes on `order by id desc`.
  - |
    Unit (wallet.service.spec.ts): `expect(sql).toMatch(/order by id desc/)` for the history select, and `expect(sql).toMatch(/clock_timestamp\(\)/)` for the ledger insert in `change()`.
  - |
    AC7: insert HISTORY_PAGE_SIZE + 3 entries; `expect(page1.entries[0].id).toBe(newestId)`, `expect(page1.pageCount).toBe(2)`, `expect(page2.entries).toHaveLength(3)` and page 2 holds the older ids.
  - |
    Web (HistoryTable.test.tsx): render one entry of each kind and `expect(screen.getByText('Welcome bonus')).toBeInTheDocument()` plus each row's balance cell, covering AC5 display.
  - |
    Migration 004 is idempotent: run it twice in the e2e suite and `expect` no error; existing entries still read back via `historyFor`.
assumptions_or_open_questions:
  - |
    AC1-AC7 are largely satisfied by stories 053/056/065, so this item is verification plus the ordering fix. Reviewer decision, settled: keep BOTH the implementation (ordering, timestamp, index) and the tests in this story; do not reduce scope to tests only.
  - |
    Retention and backup of wallet transactions, audit record retention, and concurrent-player targets are project-wide questions that are not answered by the code; reviewer confirmed they remain open project-level questions, not addressed here. The ledger is append-only and never deleted; `recent` only hides entries older than 30 days.
  - |
    `placeBet` and `recordWin` currently have no caller (the Play feature is later); reviewer confirmed they stay in scope and are tested through the service layer, not through an HTTP route.
  - |
    The work item text contained no instructions outside the change itself.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: no row changes. Migration 004 only adds an index. Existing `created_at` values are untouched; old rows sort by `id`, which for existing rows already follows insertion order.
  - **Backfill / seed**: none needed. `create index if not exists` is safe to re-run.
  - **Settings**: none.
  - **Provisioning**: none.
  - **Order and rollback**: apply migration 004 before or with the new code (the code works without the index, only slower). Roll back by dropping the index and reverting the sort.

  Findings: `WalletService.change()` (services/api/src/wallet/wallet.service.ts) does a conditional UPDATE, which locks the wallet row, then inserts the ledger row, then commits, so the balance and the entry are always consistent. `balanceFor` reads `wallets.balance_credits`, which equals the latest entry's `balance_after_credits` by construction.

  ```mermaid
  flowchart TD
    Ctl[WalletController] --> Svc[WalletService]
    Players[PlayersService] --> Ledger[(wallet_entries)]
    Svc --> Ledger
    Mig[004 migration index] --> Ledger
    Web[HistoryTable] --> Ctl
    classDef touched fill:#f96,color:#000
    class Svc,Players,Mig touched
  ```
review_focus: |
  IN: the history sort key and ledger insert timestamp (answering the concurrent bet/win question), one additive index migration, and tests for AC1-7. OUT: starting-balance and top-up rules, jackpot, any UI change, retention/backup. Riskiest part is the concurrency test, which must reliably invert `created_at` order; the `id`-based ordering is deliberate, not an oversight.
