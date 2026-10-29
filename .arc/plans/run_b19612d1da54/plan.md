summary: |
  Extend the wallet ledger so a bet entry records how many credits of that bet fed the jackpot, and a win entry records the jackpot tier (Grand, Major, Minor, Mini) when it was a jackpot win. The Records API returns both on each history entry, and the web History screen shows them in two new columns, "Jackpot contribution" (bets only, always two decimals) and "Jackpot tier" (a word badge on jackpot wins only, a dash otherwise). The approved prototype shows two views over the same data, Wallet transactions (every entry) and Play history (bets and wins only), so the plan adds a `view` selector to the history endpoint and tabs on the screen. Pool mechanics and payout rules stay out of scope: the wallet only stores and reports what its caller passes.
scope:
  - description: |
      New migration 004 adds two nullable columns to wallet_entries. Nullable with no default means every existing row stays valid (null = no contribution / no tier).
      ```sql
      alter table wallet_entries add column if not exists jackpot_contribution_credits numeric(18,6)
        check (jackpot_contribution_credits >= 0);
      alter table wallet_entries add column if not exists jackpot_tier text
        check (jackpot_tier in ('Grand','Major','Minor','Mini'));
      -- a tier only on a win, a contribution only on a bet
      alter table wallet_entries drop constraint if exists wallet_entries_jackpot_kind_chk;
      alter table wallet_entries add constraint wallet_entries_jackpot_kind_chk check (
        (jackpot_tier is null or kind = 'win') and (jackpot_contribution_credits is null or kind = 'bet'));
      ```
    files:
      - services/api/migrations/004_wallet_entries_jackpot.sql
    rationale: |
      migrate.ts applies every migrations/*.sql in name order and the files are idempotent, so 004 follows that convention. Fractional contributions need numeric, not the bigint credit columns.
  - description: |
      WalletService: extend the entry type, accept optional jackpot data on placeBet/recordWin, write it in the same insert, return it from historyFor, and add a `view` filter.
      ```ts
      export type JackpotTier = 'Grand' | 'Major' | 'Minor' | 'Mini';
      export type HistoryView = 'wallet' | 'play';
      export type HistoryEntry = { ...existing; jackpotContributionCredits: number | null; jackpotTier: JackpotTier | null };
      placeBet(playerId: string, amount: unknown, jackpot?: { contributionCredits: number }): Promise<WalletResult>
      recordWin(playerId: string, amount: unknown, jackpot?: { tier: JackpotTier }): Promise<WalletResult>
      historyFor(playerId, { page, range, view }: { page: number; range: HistoryRange; view: HistoryView }, now?)
      ```
      `change()` gains the two extra insert parameters. A bad contribution (not finite, negative, or above the bet) or an unknown tier returns `{ ok: false, reason: 'invalid_amount' }` before any SQL. `view = 'play'` adds `and kind in ('bet','win')` to both the count and the page query. The select adds `jackpot_contribution_credits, jackpot_tier`; Postgres returns numeric as a string, so map with `r.jackpot_contribution_credits === null ? null : Number(...)`.
    files:
      - services/api/src/wallet/wallet.service.ts
      - services/api/src/wallet/wallet.constants.ts
    rationale: |
      Both writes go through the single `change()` transaction, so the ledger row and balance still change atomically. Tier names and the allowed values live once, in wallet.constants.ts.
  - description: |
      WalletController.history reads `@Query('view')` and passes `view: view === 'play' ? 'play' : 'wallet'`, so any other value falls back to wallet transactions, as range already does.
    files:
      - services/api/src/wallet/wallet.controller.ts
    rationale: |
      The Play history tab needs bets and wins only; filtering in SQL keeps pagination counts correct.
  - description: |
      Web data layer: add `JackpotTier`, `HistoryView`, the two nullable entry fields, and a `view` argument.
      ```ts
      export type HistoryEntry = { ...existing; jackpotContributionCredits: number | null; jackpotTier: JackpotTier | null };
      export async function getWalletHistory(page: number, range: HistoryRange, view: HistoryView): Promise<WalletHistory>
      ```
      It sends `view` in the query string. `WalletHistory` also returns `view`.
    files:
      - apps/web/src/lib/session.ts
    rationale: |
      session.ts is where the server side reads the API today.
  - description: |
      HistoryTable (extend, do not add a component): two new columns after Amount, per the prototype header row "Date | Type | Amount | Jackpot contribution | Jackpot tier | Balance after". The existing labels (Time, Entry, Balance) stay, because the existing tests pin them.
      - Contribution cell, `td.num`: bets with a non-null value render `value.toFixed(2)` (0.05, 2.50); every other row renders the aria-hidden dash plus `<span className="sr">No contribution</span>` in a `td.num.none`.
      - Tier cell: a win with a tier renders `<span className="badge badge-accent|badge-warning|badge-info|badge-neutral">Grand|Major|Minor|Mini</span>` (Grand accent, Major warning, Minor info, Mini neutral, as in the prototype's TIERS map). Other rows render the dash plus `<span className="sr">No jackpot tier</span>`, so an ordinary win shows no tier (AC5).
      The caption keeps its inline `var(--space-2)` padding. Styling uses only tokens: color-fg-muted, space-2, space-3, border-width, color-border, font-size-sm.
    files:
      - apps/web/src/components/history/HistoryTable.tsx
    rationale: |
      The prototype says the existing HistoryTable is extended with two columns.
  - description: |
      HistoryScreen: add the prototype's view tabs, `<div className="tabs" role="tablist" aria-label="History views">` with two `<a className="tab" role="tab" aria-selected>` links to `/history` and `/history?view=play`. The h1 follows the active view ("Wallet transactions" / "Play history"). The `href()` helper carries `view` along with `range` and `page`. History page reads `searchParams.view` and passes it to getWalletHistory. The existing "Most recent / Older entries" pager, 30-day range switch, loading.tsx skeleton and empty state are kept, since they are already built and the prototype's Newer/Older buttons are a simulated pager (see open questions).
      globals.css (loaded via the `@import "../../../../design-system/tokens.css"` at line 2) already has `.tabs`, `.tab`, `.badge-*`, `.table-wrap` and `.history-table`; add only `.history-table .none { color: var(--color-fg-muted); }` and `.sr` (visually hidden), mirroring the prototype.
    files:
      - apps/web/src/components/history/HistoryScreen.tsx
      - apps/web/src/app/history/page.tsx
      - apps/web/src/app/globals.css
    rationale: |
      Tabs, badges and table styles are already in the CSS from earlier stories, so only the two small helpers are new.
  - description: |
      e2e seam: the mock API returns a bet with a jackpot contribution and a Grand win, and honours `view=play`.
    files:
      - apps/web/tests/e2e/mock-session-server.mjs
      - apps/web/tests/e2e/player-accounts.spec.ts
    rationale: |
      Playwright runs against the mock, so it needs the new fields to check the rendered page.
tests:
  - |
    AC1/AC3/AC6 (API, wallet.service.spec.ts). Write first: a bet with a contribution stores it in the same insert, and history returns it as a number.
    ```ts
    await service.placeBet('p1', 100, { contributionCredits: 0.05 });
    expect(calls[2][1]).toEqual(['p1', 'bet', 100, 400, 0.05, null]);
    await service.recordWin('p1', 5000, { tier: 'Major' });
    expect(calls[2][1]).toEqual(['p1', 'win', 5000, 5400, null, 'Major']);
    ```
  - |
    Validation (wallet.service.spec.ts). A contribution above the bet, a negative one, NaN, or an unknown tier is refused with no SQL run.
    ```ts
    expect(await service.placeBet('p1', 10, { contributionCredits: 11 })).toEqual({ ok: false, reason: 'invalid_amount' });
    expect(await service.recordWin('p1', 10, { tier: 'Huge' as never })).toEqual({ ok: false, reason: 'invalid_amount' });
    expect(calls).toEqual([]);
    ```
  - |
    AC1-AC4 (API history, wallet.service.spec.ts). historyFor maps the numeric string to a number and null to null.
    ```ts
    // row: { jackpot_contribution_credits: '0.050000', jackpot_tier: null } -> entry
    expect(entry.jackpotContributionCredits).toBe(0.05);
    expect(entry.jackpotTier).toBeNull();
    ```
  - |
    AC2/AC4/AC5 (API view filter, wallet.service.spec.ts and wallet.controller.spec.ts). The play view limits to bets and wins in both queries; an unknown view falls back to wallet.
    ```ts
    await service.historyFor('p1', { page: 1, range: 'all', view: 'play' });
    expect(pool.query.mock.calls.every(([sql]) => /kind in \('bet','win'\)/.test(sql))).toBe(true);
    ```
  - |
    Existing rows still readable after the migration (wallet.e2e-spec.ts, needs Postgres). Insert a row with the old five columns, apply 004 twice, and read it through GET /wallet/history.
    ```ts
    expect(res.body.entries[0]).toMatchObject({ jackpotContributionCredits: null, jackpotTier: null });
    ```
    A second case asserts the check constraint rejects a tier on a bet and a contribution on a win.
  - |
    AC1/AC2/AC6/AC7 (web, HistoryTable.test.tsx). A bet with 0.05 shows 0.05, with 2.5 shows 2.50, with 1 shows 1.00; a bet with null shows the dash and the "No contribution" text.
    ```ts
    expect(html).toContain('>0.05<');
    expect(html).toContain('>2.50<');
    expect(html).toContain('No contribution');
    ```
  - |
    AC3/AC4 (web, HistoryTable.test.tsx). Each of the four tiers renders its name as a badge.
    ```ts
    for (const tier of ['Grand', 'Major', 'Minor', 'Mini']) expect(html).toContain(`>${tier}</span>`);
    ```
  - |
    AC5 (web, HistoryTable.test.tsx). A win with `jackpotTier: null` renders no tier badge and shows the dash.
    ```ts
    expect(plainWinRow).not.toMatch(/Grand|Major|Minor|Mini/);
    expect(plainWinRow).toContain('No jackpot tier');
    ```
    The header test now expects 6 `<th scope="col"` cells and the "Jackpot contribution" and "Jackpot tier" labels.
  - |
    Both views (web, HistoryScreen.test.tsx and app/history/page.test.tsx). The tabs link to both views with the right `aria-selected`; the page passes `view` through to getWalletHistory and defaults to wallet.
    ```ts
    expect(html).toContain('href="/history?view=play"');
    expect(getWalletHistory).toHaveBeenCalledWith(1, 'recent', 'play');
    ```
  - |
    Playwright (player-accounts.spec.ts). The History page shows the contribution `5.00` and a `Grand` badge on both tabs, and Play history omits the Welcome bonus row.
    Narrow commands: `(cd services/api && pnpm run test -- wallet.service.spec.ts)` and `(cd apps/web && pnpm test -- HistoryTable.test.tsx)`.
assumptions_or_open_questions:
  - |
    Resolved by the reviewer, no caller. Nothing writes jackpot data yet. placeBet and recordWin only gain an optional parameter and store what a caller passes. No caller is added in this story; contribution-rate rules and calling logic belong to the future jackpot epics.
  - |
    Resolved by the reviewer, separate Play history tab. Keep the Play history tab and the API `view` filter (bets and wins only). Do not merge it into one combined screen at this time.
  - |
    Resolved by the reviewer, built screen kept. Retain the existing pager ("Most recent / Older entries"), the 30-day range switch and the current column labels (Time / Entry / Amount / Balance). Do not adopt the prototype's Newer/Older buttons or alternate headers unless a UX review asks for it.
  - |
    Resolved by the reviewer, precision. Store numeric(18,6) and round to two decimals for display only. No jackpot or pool-mechanics requirement mandates a different stored precision.
  - |
    A jackpot win is shown with its tier but the jackpot-win amount is still the ordinary win amount. Whether a jackpot win also gets its own entry kind is left to the jackpot epics.
  - |
    Resolved by the reviewer, deferred questions. Wallet and play history retention, audit record retention and concurrent-player capacity stay separate future decisions, outside this story.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: migration 004 only adds two nullable columns with checks that accept null, so every existing wallet_entries row is unchanged and reads back with `jackpotContributionCredits: null` and `jackpotTier: null`. The kind-consistency check only restricts rows that have a non-null value, so old rows pass it.
  - **Backfill / seed**: none. Old bets had no jackpot contribution and old wins had no tier, so null is the right value. The migration uses `add column if not exists` and drops then re-adds its constraint, so re-running it is safe. Adding a nullable column with no default is a metadata-only change in Postgres, so it takes no long table lock.
  - **Settings**: none.
  - **Provisioning**: none; `pnpm` migrate script in services/api (scripts/migrate.ts) applies 004 with the others.
  - **Order and rollback**: migrate first, then deploy the API, then the web app. The new API reads the columns, and the old web app ignores the extra fields. Rollback is to redeploy the old code and leave the columns in place (unused nullable columns are harmless); a down step would be `alter table wallet_entries drop column jackpot_tier, drop column jackpot_contribution_credits`.

  ### Notes

  - Tokens already load in the web app through `@import "../../../../design-system/tokens.css"` at apps/web/src/app/globals.css line 2. The prototype's colours and spacing are all token references (color-fg-muted, color-border, space-2, space-3, border-width, font-size-sm, badge-* tokens); the plan adds no literal colour or pixel value.
  - The prototype maps tiers to badges: Grand `badge-accent`, Major `badge-warning`, Minor `badge-info`, Mini `badge-neutral`. Colour is paired with the tier word, as the UI guidelines require. Grand being the one accent badge is within the once-per-view accent rule only if a page shows a single Grand win; a page with several Grand wins would repeat accent. That is the prototype's choice and I followed it.
  - Reused components: HistoryTable, HistoryScreen, LocalTime. No new component.

  ```mermaid
  flowchart TD
    Page[app/history/page.tsx]:::touched --> Screen[HistoryScreen.tsx]:::touched
    Screen --> Table[HistoryTable.tsx]:::touched
    Page --> Session[lib/session.ts getWalletHistory]:::touched
    Session -->|GET /wallet/history?view=| Ctrl[wallet.controller.ts]:::touched
    Ctrl --> Svc[wallet.service.ts]:::touched
    Svc --> Mig[migrations/004_wallet_entries_jackpot.sql]:::touched
    Svc --> Tbl[(wallet_entries)]
    Mig --> Tbl
    Future[Play feature, not built]:::ctx -.->|placeBet / recordWin with jackpot data| Svc
    classDef touched fill:#f96,color:#000
    classDef ctx fill:#ddd,color:#000
  ```
review_focus: |
  IN: the stored contribution and tier on wallet_entries, the API fields and `view` filter, and the two new History columns plus the tabs. OUT: any pool, contribution-rate or payout logic, and any caller of placeBet/recordWin with jackpot data. The riskiest parts are the migration (must leave existing rows readable) and the Play history view and tabs, which the item does not state but the prototype shows. Keeping the existing pager, range switch and header labels over the prototype's simulated ones is deliberate.
