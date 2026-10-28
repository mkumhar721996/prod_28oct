summary: |
  Add an append-only wallet ledger (`wallet_entries`) to the Records API, kept indefinitely, and route every balance change through one atomic WalletService step that updates `wallets.balance_credits` and inserts the ledger row in the same transaction. The ledger records four entry kinds: the welcome bonus (the starting grant, written by registration), bet, win and top-up. `placeBet` and `recordWin` are built now as in-process service methods (confirmed in scope by the reviewer) for the future Play feature to call. There is no Play screen and no bet or win route. The free top-up is its own session-guarded `POST /wallet/top-up`, independent of gameplay, with no cooldown (a claim is allowed whenever the balance is 1 or less), and its amount comes from a setting (`WALLET_TOP_UP_CREDITS`, default 500, and an invalid value logs a warning and falls back to 500). The `/wallet` page always shows a "Claim free credits" panel with the current balance, the eligibility status, the claim button (enabled or disabled) and text explaining the eligibility rule. `formatCredits` is fixed to say "1 credit" and "2 credits". `GET /wallet/history` returns the player's own entries, newest first, 10 per page. By default only the last 30 days are shown (inclusive), and `?range=all` retrieves the older entries. The Web App gets a History page (the approved "Play history" design) whose times are stored in UTC and shown in the viewer's local time zone, plus a History nav entry. No admin history route is built.
scope:
  - description: |
      Migration `002_wallet_entries.sql` (idempotent, applied by `pnpm run migrate`): the ledger, plus a backfill of the welcome bonus for existing players.

      ```sql
      create table if not exists wallet_entries (
        id bigserial primary key,
        player_id uuid not null references players (id),
        kind text not null check (kind in ('grant', 'bet', 'win', 'topup')),
        amount_credits bigint not null check (amount_credits >= 1),
        balance_after_credits bigint not null check (balance_after_credits >= 0),
        created_at timestamptz not null default now()
      );
      create index if not exists wallet_entries_player_created_idx
        on wallet_entries (player_id, created_at desc, id desc);
      create unique index if not exists wallet_entries_one_grant_idx
        on wallet_entries (player_id) where kind = 'grant';

      insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits, created_at)
      select p.id, 'grant', 1000, 1000, p.created_at
        from players p
       where not exists (select 1 from wallet_entries e where e.player_id = p.id and e.kind = 'grant');
      ```

      `created_at timestamptz` is stored as an absolute instant (UTC); nothing is ever converted to local time in storage. No row is ever deleted.
    files:
      - services/api/migrations/002_wallet_entries.sql
    rationale: |
      One ledger row per grant, bet, win and top-up gives the history its time and resulting balance (AC11). The partial unique index makes the welcome bonus idempotent, so the backfill is safe to re-run and a second grant can never be written. The index serves the "newest first" query. The FK to players means the existing `truncate sessions, wallets, players cascade` in the e2e suite also clears the ledger. The backfill uses 1000, the value of `STARTING_GRANT` at the time the existing wallets were created. Those wallets cannot have had bets, wins or top-ups, because no feature changed a balance before this item.
  - description: |
      Registration writes the welcome bonus to the ledger. In `PlayersService.register`, after `insert into wallets`, and before `commit`, add:

      ```ts
      await client.query(
        "insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits) values ($1, 'grant', $2, $2)",
        [player.id, STARTING_GRANT],
      );
      ```

      It stays in the same transaction as the player and wallet rows, so a failure rolls back all three.
    files:
      - services/api/src/players/players.service.ts
      - services/api/src/players/players.service.spec.ts
    rationale: |
      The reviewer decided that the starting grant must appear in history as a transaction ("Welcome bonus"), so players see their full balance history from account creation. This also makes the ledger sum to the wallet balance. The existing spec asserts the exact call order (`begin`, player insert, wallet insert, `commit`), so it is updated to expect the ledger insert before `commit`.
  - description: |
      Wallet settings, constants and the atomic balance operations in WalletService. Signatures:

      ```ts
      // wallet.config.ts
      export const DEFAULT_TOP_UP_CREDITS = 500;
      export const INVALID_TOP_UP_WARNING =
        'Invalid WALLET_TOP_UP_CREDITS value detected. Falling back to default value: 500.';
      /**
       * WALLET_TOP_UP_CREDITS. Unset or empty means 500 with no warning. A value that is not a whole
       * number of 1 or more logs INVALID_TOP_UP_WARNING (Nest Logger.warn) and returns 500. Never throws.
       */
      export function topUpCredits(
        env: NodeJS.ProcessEnv = process.env,
        warn: (message: string) => void = (m) => new Logger('WalletConfig').warn(m),
      ): number

      // wallet.constants.ts
      export const MIN_BET = 1;
      export const HISTORY_PAGE_SIZE = 10;
      export const HISTORY_WINDOW_DAYS = 30;
      export const canBet = (balance: number) => balance > MIN_BET; // same threshold the top-up uses

      // wallet.service.ts
      export type WalletRefusal = 'invalid_amount' | 'insufficient_balance' | 'balance_not_low';
      export type WalletResult =
        | { ok: true; balanceCredits: number }
        | { ok: false; reason: WalletRefusal };
      readonly topUpCredits: number // = topUpCredits(), resolved once in the constructor, so a bad value is warned once at API start
      placeBet(playerId: string, amount: unknown): Promise<WalletResult>   // in-process, for the future Play feature
      recordWin(playerId: string, amount: unknown): Promise<WalletResult>  // in-process, for the future Play feature
      claimTopUp(playerId: string): Promise<WalletResult>                  // amount = this.topUpCredits
      ```

      Each method runs in ONE transaction on a pooled client (the pattern `PlayersService.register` already uses: begin, work, commit, rollback in catch, release in finally). The check and the change are a single conditional statement, so the row lock on the wallet row serialises concurrent callers and the second sees the new balance:

      ```sql
      update wallets set balance_credits = balance_credits - $2
       where player_id = $1 and balance_credits > $2
      returning balance_credits
      ```

      When no row comes back, the bet is refused with `insufficient_balance` and nothing is written. On success, insert into `wallet_entries` (kind, amount, `balance_after_credits` = the returned balance) before commit. `recordWin` uses `balance_credits + $2`. `claimTopUp` adds the configured amount with `where balance_credits <= 1` (refusal `balance_not_low`). The amount is validated before any SQL: `Number.isSafeInteger(amount) && amount >= MIN_BET`, otherwise `invalid_amount`. That covers 0, -1 and 1.5 (AC6, 16, 17) and strings or NaN. There is no claim cooldown and no stored claim time.
    files:
      - services/api/src/wallet/wallet.config.ts
      - services/api/src/wallet/wallet.constants.ts
      - services/api/src/wallet/wallet.service.ts
    rationale: |
      A conditional UPDATE inside a transaction is the simplest correct answer to the deferred concurrency question: Postgres row locking, with no extra lock code. The ledger is append-only, so it doubles as the audit trail. `balance > bet` is strict, so a player can never bet their whole balance (AC5, 8, 9), and the wallet `check (balance_credits >= 0)` stays a second safety net. The bet and win methods are service methods only, as the reviewer confirmed: ACs 1 to 9, 16 and 17 depend on them. The top-up amount moves out of code into a setting, and a bad setting degrades to the default with a warning instead of stopping the API from starting.
  - description: |
      Wallet HTTP surface on WalletController (all guarded by SessionGuard, with the player id from the session only, as `balance()` does).

      - `GET /wallet` keeps `balanceCredits` and adds the top-up state the panel needs: `{ balanceCredits, topUp: { eligible: boolean, credits: number } }`, where `eligible` is `balanceCredits <= 1` (the same threshold the claim enforces, `!canBet(balance)`) and `credits` is `WalletService.topUpCredits`. Old clients that read only `balanceCredits` keep working.
      - `POST /wallet/top-up` calls `claimTopUp(req.player.id)`. It returns `200 { balanceCredits, grantedCredits }` on success and `409 Conflict` with the message "Your balance is more than 1 credit, so a free top-up is not available." on `balance_not_low`. The rule is enforced in SQL, so a player cannot mint credits by calling the route when not low. There is no bet or win route.
      - `GET /wallet/history?page=N&range=recent|all` calls `historyFor(playerId, { page, range }, now = new Date())` and returns `{ entries: { id, kind, amountCredits, balanceCredits, createdAt }[], page, pageCount, total, range }`, with `createdAt` as an ISO-8601 UTC string. `range` defaults to `recent`. `recent` filters `created_at >= $now - interval '30 days'` (inclusive: exactly 30 days is listed, 31 days is not). `all` has no date filter and returns the older entries too. Both order by `created_at desc, id desc` with `limit 10 offset (page-1)*10`, and a `count(*)` over the same filter gives `total` and `pageCount`. A bad `page` means 1 and an unknown `range` means `recent`. This is the player's own history only. No admin route exists.
    files:
      - services/api/src/wallet/wallet.service.ts
      - services/api/src/wallet/wallet.controller.ts
      - services/api/src/wallet/wallet.controller.spec.ts
    rationale: |
      Top-up works independently of gameplay, and `GET /wallet` now tells the panel whether a claim is available and how many credits it grants, from one source of truth. Retention is "keep everything, hide older than 30 days by default", so the window is a read-time filter and `range=all` is the filtering route to older entries. `now` is injectable so the 30 versus 31 day boundary is testable without a clock mock.
  - description: |
      Singular and plural credits. Fix `formatCredits` in `BalanceTile.tsx`, which today always prints "credits" (so a balance of 1 reads "1 credits"):

      ```ts
      // before
      export const formatCredits = (credits: number) => `${credits.toLocaleString("en-US")} credits`;
      // after
      export const formatCredits = (credits: number) =>
        `${credits.toLocaleString("en-US")} ${credits === 1 ? "credit" : "credits"}`;
      ```

      Results: 1 gives "1 credit", 0 gives "0 credits", 2 gives "2 credits", 500 gives "500 credits", 1000 gives "1,000 credits". `BalanceTile` uses it for the balance figure, and the claim panel uses it for every credit amount, so one helper keeps all the wording consistent.
    files:
      - apps/web/src/components/BalanceTile.tsx
      - apps/web/src/components/BalanceTile.test.tsx
    rationale: |
      The reviewer asked for proper singular and plural wording. `formatCredits` is only used by BalanceTile today (I searched `apps/web`), so the change is contained, and the prototype also writes "1 credit". No test of `BalanceTile` exists yet, so a new one pins the wording.
  - description: |
      "Claim free credits" panel on `/wallet`, always shown (reviewer-approved for this story, with copy and styling to be refined in review once a formal design exists). New client component `ClaimCreditsPanel`, rendered by `app/wallet/page.tsx` under the existing BalanceTile. The page switches from `getWalletBalance()` to a new `getWallet()` in `lib/session.ts` that returns `{ balanceCredits, topUp }` from `GET /wallet` (`getWalletBalance` stays for its existing test and callers). A new client function `claimFreeCredits()` posts to `/api/wallet/top-up` with `credentials: "include"` and returns `{ ok: true, balanceCredits, grantedCredits } | { ok: false, message }`. `next.config.ts` gets one more rewrite, `{ source: "/api/wallet/top-up", destination: `${apiUrl}/wallet/top-up` }`, next to the existing `/api/orders` one (under `/api` because `/wallet` is the page itself).

      The panel is a `.card stack stack-2`, taken from the prototype's low-balance panel (`low-balance-panel`) and generalised so it is always shown:

      - Heading `h2` "Free credits".
      - Current balance: "Your balance is {formatCredits(balance)}."
      - Eligibility status, always with a word: `.badge-success` "Available" when eligible, or `.badge-neutral` "Not available" when not.
      - Informational text explaining the requirement. Eligible: "Your balance is 1 credit or less, so you can claim free credits." Not eligible: "Free credits are available when your balance is 1 credit or less." There is no cooldown, so this balance rule is the whole requirement.
      - Credits granted: "A claim adds {formatCredits(topUp.credits)}."
      - Claim button, `.btn .btn-secondary` "Claim free credits" (the prototype's label and class; the page has no primary action). It is disabled with `aria-disabled` when not eligible, and reads "Claiming…" and is disabled while the request runs, so it cannot be double-submitted.
      - Result: on success an `.alert .alert-success` with `role="status"` reading "Free credits claimed: {formatCredits(granted)}. Balance {formatCredits(balance)}." (the prototype's toast wording), then `router.refresh()` so the BalanceTile and the panel's status update from the server. On failure an `.alert .alert-danger` with `role="alert"` showing the API message, or "Couldn't claim free credits. Try again." when there is none, with focus moved to it, as the prototype does for refusals.

      Styling uses only classes and tokens that already exist in `globals.css`.
    files:
      - apps/web/src/components/ClaimCreditsPanel.tsx
      - apps/web/src/components/ClaimCreditsPanel.test.tsx
      - apps/web/src/app/wallet/page.tsx
      - apps/web/src/app/wallet/page.test.tsx
      - apps/web/src/lib/session.ts
      - apps/web/src/lib/session.test.ts
      - apps/web/next.config.ts
    rationale: |
      The reviewer asked for the claim panel on `/wallet` as the main entry point for the top-up. It reuses BalanceTile, the prototype's low-balance panel and its wording, and the `.alert-*`, `.badge-*` and `.btn-*` classes. The server rule stays the single source of truth: the panel only reads `eligible` and `credits` from the API, so the UI cannot drift from the 1-credit threshold.
  - description: |
      Web App server-side fetch and History route. `getWalletHistory(page, range)` goes in `lib/session.ts` next to `getWalletBalance` (same cookie forwarding, `cache: "no-store"`, throws on a non-OK response). `app/history/page.tsx` is a server component that redirects to `/sign-in?next=history` when signed out (as `wallet/page.tsx` does), reads `searchParams.page` and `searchParams.range`, and renders HistoryScreen. `app/history/loading.tsx` renders the `.skeleton` lines shown in the design, mirroring `wallet/loading.tsx`.
    files:
      - apps/web/src/lib/session.ts
      - apps/web/src/app/history/page.tsx
      - apps/web/src/app/history/loading.tsx
    rationale: |
      Follows the existing wallet page pattern, so auth, cookies and the API base URL are already solved.
  - description: |
      New components, built from the design's "Play history" screen. `HistoryScreen` has an `h1` "History", a muted line, HistoryTable, and the pager. In the default view the line reads "Entries from the last 30 days, most recent first." In the `all` view it reads "All entries, most recent first." `HistoryTable` is a `.table-wrap` plus a `table.history-table` with caption "Showing a to b of n entries", columns Time, Entry, Amount (`.num`) and Balance (`.num`), and `th scope="col"`. The Entry cell is a `.badge` with a word: Welcome bonus is `badge-accent`, Bet is `badge-neutral`, Win is `badge-success`, Top-up is `badge-info`. Each player has exactly one welcome bonus, so `badge-accent` appears at most once per view, which the guidelines allow. Amount is signed (U+2212 minus for bet, plus otherwise) and Balance is the `balance_after` figure, both formatted with `toLocaleString("en-US")` as bare numbers, as in the prototype's table, so they do not use `formatCredits`.

      The Time cell is `LocalTime`, a small client component:

      ```tsx
      // LocalTime.tsx ("use client")
      export function LocalTime({ iso }: { iso: string }) // <time dateTime={iso}>
      ```

      It first renders the UTC string (for example "Oct 28, 14:30 UTC"), so server and client markup match. After mount (`useEffect`) it re-renders in the viewer's local zone with `Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })`. If `Intl` fails, the UTC text stays. This is the "local time when possible" rule.

      The pager has a "Most recent" link (aria-disabled on page 1), "Page x of y" in `.text-sm .text-muted`, and an "Older entries" link styled `.btn .btn-secondary`, which is disabled and reads "No older entries" on the last page. Pages are plain links that keep the `range` parameter (`?page=2` or `?range=all&page=2`). A `.btn-ghost` link under the pager switches the view: "Show all entries" (`?range=all`) in the default view and "Show last 30 days" in the `all` view. The design has no such control, so this is an addition, flagged in the open questions. When total is 0, show `.empty-state` ("No entries yet", "Place a bet and it shows up here with your new balance.") instead of the table and pager. Its primary action "Place a bet" links to `PLACE_BET_HREF`, which is `/wallet` for now.
    files:
      - apps/web/src/components/history/HistoryScreen.tsx
      - apps/web/src/components/history/HistoryTable.tsx
      - apps/web/src/components/history/LocalTime.tsx
      - apps/web/src/components/history/HistoryScreen.test.tsx
      - apps/web/src/components/history/HistoryTable.test.tsx
      - apps/web/src/components/history/LocalTime.test.tsx
    rationale: |
      The catalogue has no history component, so these are new, as the design says (HistoryScreen and HistoryTable). They reuse the existing `.narrow stack stack-4`, `.badge-*`, `.empty-state`, `.skeleton`, `.btn-secondary` and `.btn-ghost` classes. They follow the OrdersScreen and OrderRow split. `LocalTime` is a client component because only the browser knows the viewer's time zone.
  - description: |
      Styles, navigation and the settings doc. Append the design's history rules to `globals.css`, using tokens only: `.table-wrap` (`--border-width`, `--color-border`, `--radius-md`), `.history-table` (`--font-size-sm`, `--space-2`, `--color-bg-subtle`, `--font-weight-semibold`, `--color-border`), `.num`, `.pager` (`--space-2`), and the disabled-link colour `--color-fg-muted`. The tokens are already loaded by the app (`globals.css` already uses `var(--space-1)`, `var(--size-modal)` and similar at lines 144-146). In `lib/shell.ts`, add `HISTORY_HREF = "/history"` and a `{ key: "history", label: "History", href: HISTORY_HREF }` entry at the END of `MAIN_NAV`, and add:

      ```ts
      /** Temporary: the Play screen does not exist yet. Point this at the Play route when that feature ships. */
      export const PLACE_BET_HREF = WALLET_HREF;
      ```

      Add a `WALLET_TOP_UP_CREDITS` row to the env var table in `services/api/README.md`, noting the default of 500 and that an invalid value logs a warning and falls back to 500.
    files:
      - apps/web/src/app/globals.css
      - apps/web/src/lib/shell.ts
      - services/api/README.md
    rationale: |
      The UI guidelines say new sections go at the end of the nav and every style must come from tokens. One constant for the "Place a bet" target means the future Play feature changes a single line. The README is where the API's settings are documented.
tests:
  - |
    AC1, bet reduces the balance. Unit (`wallet.service.spec.ts`, mocked pool/client in the style of `players.service.spec.ts`). Write first, run it red:
    ```ts
    const r = await service.placeBet('p1', 100); // update returns balance_credits 400
    expect(r).toEqual({ ok: true, balanceCredits: 400 });
    expect(sqlOf(calls)).toEqual(['begin', expect.stringMatching(/^update wallets/), expect.stringMatching(/^insert into wallet_entries/), 'commit']);
    expect(calls[2][1]).toEqual(['p1', 'bet', 100, 400]);
    ```
    Also an e2e check (`wallet.e2e-spec.ts`, real Postgres): seed a wallet at 500, then `placeBet(id, 100)` gives `balanceFor(id) === 400`.
  - |
    AC2, a win adds to the balance:
    ```ts
    expect(await service.recordWin('p1', 250)).toEqual({ ok: true, balanceCredits: 650 }); // wallet seeded at 400
    expect(calls[2][1]).toEqual(['p1', 'win', 250, 650]);
    ```
    The e2e version also checks the ledger: one `win` row with `balance_after_credits = 650`.
  - |
    AC3, concurrent bets, in the e2e spec against real Postgres (a mock cannot prove atomicity). Wallet seeded at 10:
    ```ts
    const results = await Promise.all([service.placeBet(id, 6), service.placeBet(id, 6)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await service.balanceFor(id)).toBe(4);
    expect(await entryCount(id, 'bet')).toBe(1);
    ```
    A unit test also asserts the check and the change are one statement with the `balance_credits > $2` predicate.
  - |
    AC4, a bet of 9 on a balance of 10 is accepted:
    ```ts
    expect(await service.placeBet('p1', 9)).toEqual({ ok: true, balanceCredits: 1 });
    ```
  - |
    AC5, a bet equal to the balance is refused. The update returns no rows:
    ```ts
    expect(await service.placeBet('p1', 10)).toEqual({ ok: false, reason: 'insufficient_balance' });
    expect(sqlOf(calls)).not.toContain(expect.stringMatching(/^insert into wallet_entries/));
    expect(sqlOf(calls)).toContain('rollback');
    ```
    The e2e version asserts `balanceFor(id) === 10` and no ledger row.
  - |
    AC6, a bet of 0 is refused before any SQL runs:
    ```ts
    expect(await service.placeBet('p1', 0)).toEqual({ ok: false, reason: 'invalid_amount' });
    expect(pool.connect).not.toHaveBeenCalled();
    ```
  - |
    AC7, balance 2, bet 1 is accepted:
    ```ts
    expect(await service.placeBet('p1', 1)).toEqual({ ok: true, balanceCredits: 1 });
    ```
  - |
    AC8 and AC9, balances of 1 and 0 with a bet of 1 are refused (e2e, so the real predicate runs):
    ```ts
    for (const start of [1, 0]) {
      await seedWallet(id, start);
      expect(await service.placeBet(id, 1)).toEqual({ ok: false, reason: 'insufficient_balance' });
      expect(await service.balanceFor(id)).toBe(start);
    }
    ```
    A pure unit test of `canBet`: `expect(canBet(1)).toBe(false); expect(canBet(2)).toBe(true);`
  - |
    AC10, a top-up from a balance of 1 (e2e, real Postgres), with the default amount:
    ```ts
    const r = await service.claimTopUp(id); // wallet seeded at 1
    expect(r).toEqual({ ok: true, balanceCredits: 501 });
    expect(await lastEntryKind(id)).toBe('topup');
    ```
    Plus the guard, `expect(await service.claimTopUp(id)).toEqual({ ok: false, reason: 'balance_not_low' })` for a balance of 2, so the top-up and the bet share one threshold. A second claim straight after the first (balance now 501) is refused, and a claim is allowed again whenever the balance drops back to 1 or less, since there is no cooldown. Over HTTP, `POST /wallet/top-up` with a session returns 200 and `{ balanceCredits: 501, grantedCredits: 500 }` from a balance of 1, returns 409 from a balance of 2, and returns 401 without a session.
  - |
    Top-up amount setting and fallback (`wallet.config.spec.ts`):
    ```ts
    const warn = jest.fn();
    expect(topUpCredits({}, warn)).toBe(500);
    expect(topUpCredits({ WALLET_TOP_UP_CREDITS: '' }, warn)).toBe(500);
    expect(topUpCredits({ WALLET_TOP_UP_CREDITS: '750' }, warn)).toBe(750);
    expect(warn).not.toHaveBeenCalled();
    for (const bad of ['0', '-5', '1.5', 'abc', '9007199254740993']) {
      warn.mockClear();
      expect(topUpCredits({ WALLET_TOP_UP_CREDITS: bad }, warn)).toBe(500); // does not throw
      expect(warn).toHaveBeenCalledWith(
        'Invalid WALLET_TOP_UP_CREDITS value detected. Falling back to default value: 500.',
      );
    }
    ```
    A service test constructs `WalletService` with `WALLET_TOP_UP_CREDITS=750` and expects `claimTopUp` from a balance of 1 to return `balanceCredits: 751`. Another constructs it with `WALLET_TOP_UP_CREDITS=abc` and expects the constructor not to throw, `service.topUpCredits` to be 500 and `claimTopUp` from a balance of 1 to return 501.
  - |
    Singular and plural credits (`BalanceTile.test.tsx`). Write first, run it red against the current helper:
    ```tsx
    expect(formatCredits(1)).toBe('1 credit');
    expect(formatCredits(0)).toBe('0 credits');
    expect(formatCredits(2)).toBe('2 credits');
    expect(formatCredits(500)).toBe('500 credits');
    expect(formatCredits(1000)).toBe('1,000 credits');
    render(<BalanceTile credits={1} />);
    expect(screen.getByText('1 credit')).toBeInTheDocument();
    ```
  - |
    Claim panel data and route (`wallet.controller.spec.ts` and the e2e spec). `GET /wallet` returns the new shape:
    ```ts
    expect(body).toEqual({ balanceCredits: 1, topUp: { eligible: true, credits: 500 } });
    ```
    With a balance of 2 it returns `topUp.eligible === false`. With a session of a different player it returns that player's own balance only.
  - |
    Claim panel UI (`ClaimCreditsPanel.test.tsx`, vitest and testing-library, with `claimFreeCredits` and `useRouter` mocked). Eligible, balance 1:
    ```tsx
    render(<ClaimCreditsPanel balanceCredits={1} topUp={{ eligible: true, credits: 500 }} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Your balance is 1 credit.')).toBeInTheDocument();
    expect(screen.getByText('A claim adds 500 credits.')).toBeInTheDocument();
    expect(screen.getByText(/1 credit or less, so you can claim free credits/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim free credits' })).toBeEnabled();
    ```
    Not eligible, balance 2:
    ```tsx
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByText('Your balance is 2 credits.')).toBeInTheDocument();
    expect(screen.getByText('Free credits are available when your balance is 1 credit or less.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim free credits' })).toBeDisabled();
    ```
    The panel renders in both states (it is never hidden). Clicking Claim on the eligible panel shows "Claiming…" and a disabled button while pending, then, on `{ ok: true, balanceCredits: 501, grantedCredits: 500 }`, a `role="status"` alert with `Free credits claimed: 500 credits. Balance 501 credits.` and `refresh` called once. On `{ ok: false, message: 'Your balance is more than 1 credit, so a free top-up is not available.' }` a `role="alert"` with that message and no refresh. `session.test.ts` covers `getWallet()` (the shape, and a throw on a non-OK response) and `claimFreeCredits()` (200, 409 with a message, and a network error giving the generic message).
  - |
    Wallet page (`app/wallet/page.test.tsx`, updated for `getWallet`). Signed out still redirects to sign-in and does not call the wallet. Signed in with `{ balanceCredits: 1000, topUp: { eligible: false, credits: 500 } }` renders the BalanceTile figure "1,000 credits" and the "Free credits" panel with "Not available". With `{ balanceCredits: 1, topUp: { eligible: true, credits: 500 } }` it shows "1 credit" in the tile and "Available" in the panel.
  - |
    AC11, history lists each entry with its time and resulting balance. E2e: place a bet, record a win and claim a top-up, then:
    ```ts
    const h = await service.historyFor(id, { page: 1, range: 'recent' });
    expect(h.entries.map((e) => e.kind)).toEqual(['topup', 'win', 'bet']);
    expect(h.entries[0]).toMatchObject({ balanceCredits: expect.any(Number), createdAt: expect.stringMatching(/Z$/) });
    ```
    The web component test, `HistoryTable.test.tsx`: one row per entry, with `getByText('Bet')`, `getByText('Win')`, `getByText('Top-up')`, `getByText('Welcome bonus')` and the balance cell text.
  - |
    Welcome bonus in history. Registration unit test (updated `players.service.spec.ts`):
    ```ts
    expect(sql[2]).toMatch(/^insert into wallets/);
    expect(sql[3]).toMatch(/^insert into wallet_entries/);
    expect(calls[3][1]).toEqual(['p1', STARTING_GRANT]);
    expect(sql[4]).toBe('commit');
    ```
    And a rollback test where the ledger insert throws, expecting `rollback` and no `commit`. E2e: after `POST /session/register`, `historyFor(id, { page: 1, range: 'recent' })` returns one entry `{ kind: 'grant', amountCredits: 1000, balanceCredits: 1000 }`.
  - |
    AC12, paging, with a control to view older entries. Seed 24 entries:
    ```ts
    const h = await service.historyFor(id, { page: 1, range: 'recent' });
    expect(h.entries).toHaveLength(10);
    expect(h.pageCount).toBe(3);
    ```
    `HistoryScreen.test.tsx` renders page 1 of 3 and expects `screen.getByRole('link', { name: 'Older entries' })` to have `href="/history?page=2"`. On the last page, "No older entries" is shown and is not a link. In the `all` view the link keeps the range: `href="/history?range=all&page=2"`.
  - |
    AC13, the oldest page lists the first entry from account creation. The player is created through `register` (so it has the welcome bonus), then 24 more entries are added with `created_at` spread over the last 29 days, the oldest being the grant:
    ```ts
    const last = await service.historyFor(id, { page: 3, range: 'recent' });
    expect(last.entries.at(-1)).toMatchObject({ kind: 'grant' });
    ```
    The item's wording ("a bet recorded at account creation") is met by a bet recorded as the first entry after the grant. A second assertion checks that a bet seeded as the oldest entry is also listed on the oldest page.
  - |
    AC14, an entry 31 days old is not in the default view, using the injected `now`, and `range=all` still retrieves it (nothing is deleted):
    ```ts
    await insertEntry(id, { createdAt: daysBefore(NOW, 31) });
    expect((await service.historyFor(id, { page: 1, range: 'recent' }, NOW)).entries).toHaveLength(0);
    expect((await service.historyFor(id, { page: 1, range: 'all' }, NOW)).entries).toHaveLength(1);
    ```
  - |
    AC15, an entry exactly 30 days old is listed:
    ```ts
    await insertEntry(id, { createdAt: daysBefore(NOW, 30) });
    expect((await service.historyFor(id, { page: 1, range: 'recent' }, NOW)).entries).toHaveLength(1);
    ```
  - |
    AC16, a bet of -1 is refused and the balance is unchanged:
    ```ts
    expect(await service.placeBet('p1', -1)).toEqual({ ok: false, reason: 'invalid_amount' });
    ```
  - |
    AC17, a bet of 1.5 is refused and the balance is unchanged:
    ```ts
    expect(await service.placeBet('p1', 1.5)).toEqual({ ok: false, reason: 'invalid_amount' });
    ```
    Add the non-numeric cases `'abc'`, `NaN` and `Infinity` as `it.each`.
  - |
    History controller and security (`wallet.controller.spec.ts` or the e2e spec). `GET /wallet/history` without a session returns 401. With a session it returns only that player's entries (a second player's entries never appear, even with `range=all`), `?page=abc` behaves as page 1, and `?range=bogus` behaves as `recent`.
  - |
    Existing data stays usable (migration test, e2e): a wallet and player created before `002`, with no ledger rows, is given exactly one `grant` row of 1000 after the migration, dated at `players.created_at`. Running the migration a second time adds no row. The wallet still reads its balance and accepts a bet. The history shows the grant (when `players.created_at` is inside the window) and the bet, and `range=all` shows the grant even when the player is 90 days old.
  - |
    Local time display (`LocalTime.test.tsx`). The first render shows UTC text and `<time dateTime>` carries the ISO string. After mount, with the timezone fixed (`vi.stubEnv('TZ', 'Asia/Kolkata')` or a stubbed `Intl.DateTimeFormat`), the text is in that zone:
    ```tsx
    render(<LocalTime iso="2026-10-28T14:30:00.000Z" />);
    expect(screen.getByText('Oct 28, 14:30 UTC')).toBeInTheDocument(); // before effects
    expect(await screen.findByText('Oct 28, 20:00')).toBeInTheDocument(); // Asia/Kolkata, UTC+5:30
    expect(screen.getByRole('time')).toHaveAttribute('datetime', '2026-10-28T14:30:00.000Z');
    ```
  - |
    Web wiring. `shell.test.ts`: `MAIN_NAV.at(-1)` is `{ key: 'history', label: 'History', href: '/history' }`, `isCurrent` matches `/history`, and `expect(PLACE_BET_HREF).toBe(WALLET_HREF)`. `HistoryScreen.test.tsx` checks the empty state ("No entries yet") has a link named "Place a bet" with `href="/wallet"`, and that the "Show all entries" link has `href="/history?range=all"`. `app/history/page.test.tsx`, in the style of `wallet/page.test.tsx`: it redirects to sign-in when signed out and renders the history heading when signed in. Extend `tests/e2e/mock-session-server.mjs` with `/wallet/history` and `/wallet/top-up` stubs (and the new `GET /wallet` shape), and add Playwright checks to `player-accounts.spec.ts`: the History nav opens the page, and a player with a balance of 1 claims free credits on `/wallet` and sees the success message.
assumptions_or_open_questions:
  - |
    Decided by the reviewer and now in the plan: the Play screen and gameplay stay out, and no bet or win HTTP route exists. `placeBet` and `recordWin` are built now as in-process service methods, with unit and integration tests, because ACs 1 to 9, 16 and 17 depend on them. The "Place a bet" empty-state link points to `/wallet` through `PLACE_BET_HREF`, to be re-pointed when the Play feature ships.
  - |
    Decided by the reviewer: no admin history route in this item. Admin reporting, auditing and investigation are a future admin story. Older entries are reachable only by the player through `range=all`.
  - |
    Decided by the reviewer: an invalid `WALLET_TOP_UP_CREDITS` logs "Invalid WALLET_TOP_UP_CREDITS value detected. Falling back to default value: 500." as a warning and uses 500. The API still starts. An unset or empty value uses 500 silently. The value is read once when the wallet service is created, so changing it needs an API restart. The log line does not include the bad value (my choice, to keep the message exactly as suggested).
  - |
    Decided by the reviewer: no cooldown for now. A claim is allowed whenever the balance is 1 or less, so the panel shows eligibility only, with no countdown, and no claim time is stored. A cooldown later would need a rule and a schema change.
  - |
    Decided by the reviewer: the proposed wallet panel is used for this story and is always shown on `/wallet`, with the current balance, the eligibility status, the claim button (enabled or disabled) and text explaining the eligibility rule. I also kept the "A claim adds N credits" line the reviewer asked for earlier. Copy and styling can be refined in review once a formal design exists. The panel is built from the prototype's low-balance panel and existing classes only.
  - |
    Decided by the reviewer: `formatCredits` is fixed to print "1 credit", "2 credits" and "500 credits". The history table's Amount and Balance columns stay bare numbers, as in the prototype, so they are not affected.
  - |
    The welcome bonus is a fourth entry kind, `grant`, labelled "Welcome bonus" in the UI. The prototype has no such row, so `badge-accent` for it is my design extension. The AC list names only bet, win and top-up. The AC11 wording is unaffected. Existing players get a backfilled `grant` row dated at their account creation. The backfill assumes each existing wallet still holds the 1,000-credit grant (no feature has changed a balance until now).
  - |
    Retention: entries are never deleted, and the default view and API show the last 30 days. `range=all` (the player's own entries) is the filtering route to older ones, with a "Show all entries" link on the History page that the design does not have.
  - |
    Timestamps are stored as `timestamptz` (UTC), the API returns ISO-8601 UTC strings, and the browser renders them in the viewer's local zone after mount. Until then (and if `Intl` is unavailable) the page shows UTC with a "UTC" suffix. Server-rendered HTML therefore always says UTC first, then updates.
  - |
    History uses offset paging (`?page=N`, 10 per page, plus a total count), which matches the design's "Page x of y" and "Showing a to b of n". With the ledger kept indefinitely and `range=all` available, a very long history is possible, but a player's own rows are bounded in practice, so I kept offset paging over a cursor.
  - |
    The amount type is `unknown` at the service boundary so a caller passing a string or a float is refused, not coerced. The `bigint` columns come back from `pg` as strings, so the service converts with `Number()`, as `balanceFor` does. The safe-integer check bounds amounts well below 2^53.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: the migration adds a table and does not alter `players`, `wallets` or `sessions`. Existing wallets keep their balances and stay usable. The migration also backfills one `grant` ledger row per existing player (`amount` 1000, `balance_after` 1000, `created_at` = the player's `created_at`), so existing players see their account-creation entry too. There is no NOT NULL column on an existing table and no new constraint on existing rows. `GET /wallet` only gains a field, so the existing response consumers keep working.
  - **Backfill / seed**: the backfill in `002_wallet_entries.sql` is one `insert ... select ... where not exists`, backed by the partial unique index `wallet_entries_one_grant_idx`, so it is idempotent and safe to re-run (`pnpm run migrate` re-applies every file). It is a single pass over `players`, which is small at the project's scale (about 500 users, ADR-0006), so no batching is needed and the lock is brief.
  - **Settings**: new `WALLET_TOP_UP_CREDITS` for the API (`services/api`). Default 500 when unset or empty. An invalid value (not a whole number of 1 or more) logs a warning and uses 500, so it is safe to leave unset or wrong. Documented in `services/api/README.md`. `DATABASE_URL` and `RECORDS_API_URL` are unchanged. `MIN_BET`, the page size and the 30-day window stay code constants.
  - **Provisioning**: only the migration, run with `cd services/api && pnpm run migrate` against staging and then prod. Set `WALLET_TOP_UP_CREDITS` in an environment only if it should differ from 500. The Web App's new `/api/wallet/top-up` rewrite needs no new setting, because it reuses `RECORDS_API_URL`.
  - **Order and rollback**: migrate first, then deploy the API (registration, the wallet service and the new routes use `wallet_entries`), then the Web App (the History page and the claim panel call the new API routes). Rollback is to deploy the previous images. The extra table is harmless to old code, although accounts registered while the new code ran will have a ledger row the old code never reads. `drop table wallet_entries` is only needed to fully revert, and it loses the ledger. The `formatCredits` wording change is code only and has no stored data.
  - **Backups**: entries are kept indefinitely, so the ledger is ordinary Postgres data covered by the platform's database backups (the CHORE-047 decision left backups to our judgement). No separate backup job is planned.

  The test command is `(cd services/worker && pnpm test) && (cd services/api && pnpm run test) && (cd apps/web && pnpm test)`. Narrow forms while working are `cd services/api && pnpm run test -- wallet.service` and `cd apps/web && pnpm test -- ClaimCreditsPanel`. `pnpm run test` in the API is database-free (per its README), so the real-Postgres checks (AC3, 5, 8, 9, 10, 13, 14, the migration test) live in `services/api/test/wallet.e2e-spec.ts`, run with `pnpm run e2e` against a throwaway `DATABASE_URL` with the migrations applied, like `session.e2e-spec.ts`. The stack (NestJS/Postgres/jest/supertest in the API, Next.js/vitest in the web app) is unchanged and needs no new packages.

  Design notes: tokens already load through `apps/web/src/app/globals.css`, which uses `var(--space-*)` and `var(--size-modal)`. `.narrow` and `.balance-tile` are already defined there (lines 144-146). The prototype's `.history-table`, `.table-wrap` and `.pager` rules are the only new CSS and are written with tokens only. The claim panel needs no new CSS: it uses `.card`, `.stack`, `.badge-*`, `.alert-*` and `.btn-secondary`. BalanceTile is reused on `/wallet` (its `formatCredits` helper gets the singular fix) and is not used on the History page, because the design shows no balance tile there (the balance is the Balance column). The design's Play screen and "Prototype controls" boxes are never built. Extensions beyond the prototype, all flagged above: the Welcome bonus row and badge, the "Show all entries" toggle, local-time rendering, and the always-visible claim panel on `/wallet`.

  ```mermaid
  flowchart TD
    migrate[scripts/migrate.ts] --> M2[002_wallet_entries.sql]
    FutureGame[Future Play feature - caller] -.-> WS
    PS[players.service.ts register] -->|writes welcome bonus| M2
    WC[wallet.controller.ts] -->|GET wallet, GET history, POST top-up| WS[wallet.service.ts]
    WS --> CF[wallet.config.ts WALLET_TOP_UP_CREDITS fallback]
    WS --> K[wallet.constants.ts]
    WS --> DB[database.service.ts pool]
    DB --> M2
    SG[session.guard.ts] --> WC
    SS[lib/session.ts getWallet, claimFreeCredits, getWalletHistory] -->|cookie forwarded| WC
    NC[next.config.ts /api/wallet/top-up rewrite] --> WC
    WP[app/wallet/page.tsx] --> SS
    WP --> BT[BalanceTile.tsx formatCredits singular fix]
    WP --> CP[ClaimCreditsPanel.tsx]
    CP --> BT
    CP --> SS
    CP --> NC
    HP[app/history/page.tsx] --> SS
    HP --> HS[HistoryScreen.tsx]
    HS --> HT[HistoryTable.tsx]
    HT --> LT[LocalTime.tsx]
    G[globals.css] --> HS
    SH[lib/shell.ts MAIN_NAV and PLACE_BET_HREF] --> TB[TopBar.tsx]
    SH --> HS
    classDef touched fill:#f96,color:#000
    class M2,PS,WS,CF,K,WC,SS,NC,WP,BT,CP,HP,HS,HT,LT,G,SH touched
  ```

  The migration, `wallet.service.ts`, `wallet.config.ts` and `wallet.constants.ts` hold the atomic ledger and the setting. `players.service.ts` records the welcome bonus. `wallet.controller.ts` exposes the wallet summary, the top-up and the history. `lib/session.ts`, `next.config.ts`, `app/wallet/page.tsx` and `ClaimCreditsPanel.tsx` deliver the claim panel, and `BalanceTile.tsx` holds the shared `formatCredits` helper it imports. `app/history/page.tsx`, the three history components, `globals.css` and `lib/shell.ts` deliver the History page, its nav entry and the temporary "Place a bet" target. The dotted edge is the future caller and is not built here.

  The work item and the reviewer's messages contained no instructions to read secrets, contact URLs or change anything outside the repository, so nothing was refused or left out of the plan. I did not open the repo's `.env`.
review_focus: |
  IN: the `wallet_entries` migration with the welcome-bonus backfill, the welcome-bonus ledger row written by registration, the atomic `placeBet`, `recordWin` and `claimTopUp` service methods, `POST /wallet/top-up`, the extended `GET /wallet`, `GET /wallet/history` (30-day default view, `range=all`), the `WALLET_TOP_UP_CREDITS` setting with warn-and-fall-back-to-500, the always-visible "Claim free credits" panel on `/wallet`, the `formatCredits` singular fix, and the History page with local-time display. OUT: the Play screen, any bet or win HTTP route, any admin history route, and a claim cooldown (the reviewer ruled it out for now). The riskiest parts are the atomic conditional UPDATE (the real-Postgres concurrency test for AC3 proves it) and the migration backfill on rows that already exist. Deliberate choices that are not bugs: `balance > bet` is strict, the 30-day cut-off is inclusive (`>=`) but only hides entries and never deletes them, `grant` is a fourth ledger kind, an invalid top-up setting never stops the API, the panel copy is provisional until a formal design exists, and the "Place a bet" link goes to `/wallet` on purpose until the Play feature ships.
