summary: |
  Build the game screen on Home (`/`) for signed-in players: bet selector (10, 25, 50, 100, 250), a Spin button, three reels, a win/loss/insufficient-balance message and a live balance, plus the jackpot pool card from the approved prototype. A spin is ONE server-side transaction in a new Records API `game` module: it debits the bet, draws the reels, credits any win, and adds 5% of the bet to the four jackpot tiers (Mini 40%, Minor 30%, Major 20%, Grand 10%, each rounded to the cent with halves up). Because the spin commits on the server regardless of the browser, a dropped connection or closed page still leaves the wallet at the completed result, and the page reads balance and pool from the API on load (AC8). Payout amounts and jackpot symbols belong to other stories, so this plan only adds a small replaceable `evaluateSpin` seam.
scope:
  - description: |
      Migration 003: new tables `jackpot_pools` (one row per tier: `tier text primary key check (tier in ('mini','minor','major','grand'))`, `amount_cents bigint not null default 0 check (amount_cents >= 0)`) and `spins` (id bigserial, player_id uuid references players(id), bet_credits, reel1..reel3 text, win_credits, created_at timestamptz default now()). Seed the four tier rows with `insert ... on conflict (tier) do nothing` so it is safe to re-run, at the prototype's starting values (reviewer-confirmed): Mini 2,000.00, Minor 1,500.00, Major 1,000.00, Grand 500.00 (200000, 150000, 100000, 50000 cents; pool total 5,000.00). Wallet ledger rows for the spin reuse the existing `wallet_entries` kinds 'bet' and 'win', so no change to that table.
    files:
      - services/api/migrations/003_jackpot_pools_spins.sql
    rationale: |
      Tiers must be stored in cents because AC11 needs 0.38 and 0.13. Wallet balances stay whole credits (bigint), as in 001/002. `spins` is the spin audit record the deferred retention question refers to.
  - description: |
      Pure game rules, no I/O. `game.constants.ts` holds `BETS = [10, 25, 50, 100, 250] as const`, `JACKPOT_RATE_PERCENT = 5`, `TIER_SHARES = { mini: 40, minor: 30, major: 20, grand: 10 }` and `SYMBOLS = ['🍒', '🔔', 'BAR', '7']`. `jackpot.ts` exports the contribution maths in integer cents with round-half-up:

      ```ts
      export type TierCents = { mini: number; minor: number; major: number; grand: number };
      /** 5% of the bet is bet * 5 cents; each tier takes its share, half cents round up. */
      export function contributionCents(bet: number): TierCents {
        const pot = bet * JACKPOT_RATE_PERCENT; // cents
        const part = (share: number) => Math.floor((pot * share + 50) / 100);
        return { mini: part(40), minor: part(30), major: part(20), grand: part(10) };
      }
      ```
      `payout.ts` exports `evaluateSpin(reels: Reel[], bet: number): { winCredits: number }` as the single seam the payouts story replaces. Interim table copied from the prototype's placeholders: two cherries pay 1x bet, three bells pay 10x, anything else 0.
    files:
      - services/api/src/game/game.constants.ts
      - services/api/src/game/jackpot.ts
      - services/api/src/game/jackpot.spec.ts
      - services/api/src/game/payout.ts
      - services/api/src/game/payout.spec.ts
    rationale: |
      Integer cents avoid floating-point drift (0.375 and 0.125 are exact in cents x 100 but not worth risking in floats). Keeping payout behind one function lets the payouts story swap the table without touching the transaction.
  - description: |
      `GameService.spin(playerId, bet)` in one transaction on a pooled client (same shape as `WalletService.change`): validate the bet is in `BETS`; `update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits` (no row means roll back and return `insufficient_balance`); insert the 'bet' ledger row; draw three reels with `crypto.randomInt`; `evaluateSpin`; if win > 0 add it to the wallet and insert a 'win' ledger row; `update jackpot_pools set amount_cents = amount_cents + $x where tier = $t` for each tier; insert the `spins` row; commit; return the final balance, reels, win and the four tier totals. `GameService.state(playerId)` returns balance and tier totals for page load.

      ```ts
      export type SpinResult =
        | { ok: true; reels: Reel[]; betCredits: number; winCredits: number; balanceCredits: number; pool: TierCents }
        | { ok: false; reason: 'invalid_bet' | 'insufficient_balance'; balanceCredits?: number };
      spin(playerId: string, bet: unknown): Promise<SpinResult>
      ```
      `GameController` (`@Controller('game')`, `@UseGuards(SessionGuard)`, player id from `req.player.id` only): `GET /game` returns state, `POST /game/spin` with body `{ bet }` returns the result, 400 for an invalid bet, 409 with the message "Your balance of N does not cover a bet of B. Choose a lower bet." for `insufficient_balance`. `GameModule` imports `SessionModule` and `DatabaseModule` as `WalletModule` does; register it in `app.module.ts`.
    files:
      - services/api/src/game/game.service.ts
      - services/api/src/game/game.service.spec.ts
      - services/api/src/game/game.controller.ts
      - services/api/src/game/game.controller.spec.ts
      - services/api/src/game/game.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Doing debit, win, pool and audit in one transaction is what makes AC5, AC6/7 and AC8 hold together: there is no state where the bet is taken but the result is missing. The wallet row lock serialises concurrent spins. The existing `WalletService.placeBet` is left untouched (it requires balance strictly greater than the bet, see open questions), so its specs stay valid.
  - description: |
      Web data layer. `next.config.ts` gets two rewrites under `/api` because `/` is the page itself: `/api/game` to `${apiUrl}/game` and `/api/game/spin` to `${apiUrl}/game/spin`. `apps/web/src/lib/game.ts` exports server-side `getGameState()` (cookie forwarded, `cache: "no-store"`, same pattern as `getWallet` in `lib/session.ts`), client-side `spinReels(bet): Promise<SpinOutcome>` and `fetchGameState()` (both never throw; a network failure is `{ ok: false, network: true }`), plus `BETS`, `formatPool(cents)` (`"5,000.00"`, 2 decimals, `en-US`) and `resultMessage(...)` copy helpers. `shell.ts` `PLACE_BET_HREF` now points at `HOME_HREF` (its own comment says to do this when Play ships), with `shell.test.ts` updated.
    files:
      - apps/web/next.config.ts
      - apps/web/src/lib/game.ts
      - apps/web/src/lib/game.test.ts
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      Mirrors `lib/session.ts` (server fetch with forwarded cookie, client fetch via a rewrite) so no new transport pattern is introduced.
  - description: |
      Game UI built from the approved prototype (`PROD-28OCT-STORY-069-design.html`, four screens: ready, spinning, finished, balance below bet). New components under `components/game/`: `GameScreen` (client; holds balance, bet, pool, phase `idle | spinning | result | insufficient`), `ReelGrid` (three `.reel` boxes, `role="img"` with `aria-label="Reel N"`, `.is-spinning` dashed state showing `?`/cycling symbols every 120 ms), `BetSelector` (fieldset with legend "Bet", radio inputs `10 25 50 100 250` visually styled as segmented buttons, disabled while spinning), `JackpotPoolCard` (`.card` with "Jackpot pool" total, a `.btn-ghost .btn-sm` "Show pool split" toggle revealing a Mini/Minor/Major/Grand `dl`). Reuse and extend the existing `BalanceTile` with a `compact` prop that renders the "Balance" label and the bare figure in the header box with `aria-live="polite"` (the full card form on the Wallet page is unchanged). Result area: `role="status"` with hint text "Place a bet and press Spin", `.alert-success` "You win N. ..." , `.alert-info` "No win this time. You bet B. Try again.", `.alert-danger` "Your balance of N does not cover a bet of B. Choose a lower bet." plus a `.toast` (`role="alert"`, 4 s auto-hide) "Your balance does not cover this bet". The primary `.btn-primary .btn-lg` Spin button is the single primary action and shows `.spinner` + "Spinning" while disabled. The client checks `balance < bet` before calling the API (no reel spin, bet unchanged); the server enforces it again. Reels animate for at least 1400 ms (the prototype's duration), and the balance, pool and result only update when the response lands. If the spin request fails at the network level, call `fetchGameState()` and show an `.alert-info` "Welcome back. Your last spin finished while you were away, and your balance shows N." using the refetched balance (AC8 on the client). The prototype's "Simulate returning after a dropped connection" button is a review aid and is NOT built.

      `app/page.tsx` becomes: signed in, render `GameScreen` with `getGameState()` as initial props under the `h1` "Jackpot slots"; signed out, keep the existing welcome heading (`appTitle()`), so `title.test.ts` and `home.spec.ts` keep passing.

      Styling in `app/globals.css`, appended, tokens only: `.game` max-width `calc(var(--size-shell-max) / 2)`, margin `0 auto`; `.game-head` gap `var(--space-3)`, heading `var(--font-size-xl)`; balance figure `var(--font-size-xl)`, label `var(--font-size-sm)` and `var(--color-fg-muted)`; `.jackpot` card gap `var(--space-2)`, total `var(--font-size-xl)`; `.tiers` 2-column grid gap `var(--space-2)`, cells `var(--color-bg-subtle)`, `var(--radius-md)`, `var(--space-2)` padding, `dt` `var(--font-size-sm)`/`var(--color-fg-muted)`, `dd` `var(--font-weight-semibold)`; `.reels` 3 equal columns gap `var(--space-2)`; `.reel` square, `var(--border-width-strong)` solid `var(--color-border-strong)`, `var(--radius-lg)`, font-size `calc(var(--font-size-xl) * 2)` (the prototype declares both x1.5 and x2; use x2 and flag it), spinning state `var(--color-bg-subtle)`, `var(--color-fg-muted)`, dashed; `.bet-options` 5 columns gap `var(--space-2)`; `.bet-option span` min-height `var(--size-control-lg)`, `var(--border-width)` solid `var(--color-border-strong)`, `var(--radius-md)`, `var(--font-weight-medium)`, checked uses `var(--color-primary)` / `var(--color-primary-fg)`, focus ring `var(--border-width-strong)` solid `var(--color-focus)` offset `var(--size-focus-offset)`, disabled `var(--opacity-disabled)`; `.result` min-height `calc(var(--size-control) * 1.5)`; `.btn-lg` min-height `var(--size-control-lg)`, padding `0 var(--space-4)`, font `var(--font-size-lg)`; `.toast` fixed, right/bottom `var(--space-3)`, width `min(var(--size-toast), calc(100% - var(--space-4)))`, background `var(--color-fg)`, text `var(--color-bg)`, `var(--radius-md)`, z-index `var(--z-toast)`. Missing from `globals.css` today and added once there: `.btn-lg`, `.toast`. `.card`, `.alert`, `.alert-success/info/danger`, `.btn-primary`, `.btn-ghost`, `.spinner`, `.stack-4`, `.text-muted`, `.text-sm` already exist. No accent or purple colour is used, as in the prototype.
    files:
      - apps/web/src/components/game/GameScreen.tsx
      - apps/web/src/components/game/GameScreen.test.tsx
      - apps/web/src/components/game/ReelGrid.tsx
      - apps/web/src/components/game/ReelGrid.test.tsx
      - apps/web/src/components/game/BetSelector.tsx
      - apps/web/src/components/game/BetSelector.test.tsx
      - apps/web/src/components/game/JackpotPoolCard.tsx
      - apps/web/src/components/game/JackpotPoolCard.test.tsx
      - apps/web/src/components/BalanceTile.tsx
      - apps/web/src/components/BalanceTile.test.tsx
      - apps/web/src/app/page.tsx
      - apps/web/src/app/page.test.tsx
      - apps/web/src/app/globals.css
    rationale: |
      Follows the prototype's single narrow column: header with title and balance, jackpot card, reels, result, bet selector, Spin. Reuses `BalanceTile` (extended, not duplicated) and the existing `.card`/`.alert`/`.spinner` classes; the three genuinely new pieces (ReelGrid, BetSelector, JackpotPoolCard) match the prototype's own "NEW" list. The game lives under Home, as the prototype's nav shows (Home only), so no new nav entry.
  - description: |
      One Playwright journey in the web e2e suite: sign in with the mock session, pick 250, see "250" checked, press Spin, see reels and a win or loss message. `mock-session-server.mjs` gets stub `GET /game` and `POST /game/spin` handlers that behave like the real API for a fixed balance.
    files:
      - apps/web/tests/e2e/game.spec.ts
      - apps/web/tests/e2e/mock-session-server.mjs
    rationale: |
      The existing e2e specs use the mock server as the API stand-in; the game needs the same seam to be reachable in a browser test.
tests:
  - |
    AC1 (web, BetSelector.test.tsx): write first.
    ```tsx
    render(<BetSelector value={100} onChange={onChange} disabled={false} />);
    await user.click(screen.getByRole("radio", { name: "250" }));
    expect(onChange).toHaveBeenCalledWith(250);
    ```
    And in GameScreen.test.tsx: after clicking the 250 radio, `expect(screen.getByRole("radio", { name: "250" })).toBeChecked()`. Also assert exactly five radios, labelled 10, 25, 50, 100, 250.
  - |
    AC2 (web, GameScreen.test.tsx and ReelGrid.test.tsx): with balance 1000 and bet 100, clicking Spin calls `spinReels` with 100, the reels carry the `is-spinning` class while it is pending, and afterwards show the returned symbols.
    ```tsx
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(spinReels).toHaveBeenCalledWith(100);
    expect(screen.getByRole("img", { name: "Reel 1 spinning" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Reel 1" })).toHaveTextContent("🍒");
    ```
  - |
    AC3 (web, GameScreen.test.tsx; API, payout.spec.ts): a result with `winCredits: 100` shows the success alert.
    ```tsx
    expect(await screen.findByText(/You win 100/)).toBeInTheDocument();
    ```
    API side: `expect(evaluateSpin(['🍒','🍒','BAR'], 100)).toEqual({ winCredits: 100 })`.
  - |
    AC4 (web, GameScreen.test.tsx; API, payout.spec.ts): a result with `winCredits: 0` shows the loss message and no success alert.
    ```tsx
    expect(await screen.findByText(/No win this time/)).toBeInTheDocument();
    expect(screen.queryByText(/You win/)).toBeNull();
    ```
    API side: `expect(evaluateSpin(['🔔','7','🍒'], 100)).toEqual({ winCredits: 0 })`.
  - |
    AC5 (API, game.service.spec.ts; web, GameScreen.test.tsx): with a wallet of 1000 and bet 100, a loss returns 900 and a 100 win returns 1000, and the screen shows the returned balance only after the response.
    ```ts
    expect(result).toMatchObject({ ok: true, winCredits: 0, balanceCredits: 900 });
    // win case, balanceCredits: 1000
    expect(queries).toContain('bet'); // ledger kinds inserted in the same transaction: 'bet', then 'win' only when win > 0
    ```
    Web: `expect(await screen.findByText("900")).toBeInTheDocument()` inside the balance region, and `expect(within(balance).getByText("1,000")).toBeInTheDocument()` while spinning (balance unchanged until the reels stop).
  - |
    AC6 (API, jackpot.spec.ts and game.service.spec.ts): a bet of 100 adds 5 to the pool.
    ```ts
    const c = contributionCents(100);
    expect(c.mini + c.minor + c.major + c.grand).toBe(500); // 5.00 in cents
    ```
    Service spec asserts the four `update jackpot_pools` statements run inside the same begin/commit as the wallet update, and the returned pool total rises by 500 cents. Web: `JackpotPoolCard` renders `formatPool(500000 + 500)` as "5,005.00" (the prototype's finished screen shows tiers 2,002.00 / 1,501.50 / 1,001.00 / 500.50 after a 100 bet from the seeded 2,000 / 1,500 / 1,000 / 500).
  - |
    AC7 (API, jackpot.spec.ts): bet 100 splits as 2, 1.5, 1 and 0.5.
    ```ts
    expect(contributionCents(100)).toEqual({ mini: 200, minor: 150, major: 100, grand: 50 });
    ```
    Web: open "Show pool split" and assert the Mini, Minor, Major and Grand cells show the new tier values.
  - |
    AC8 (API, game.service.spec.ts; web, GameScreen.test.tsx and page.test.tsx): the transaction commits without any dependence on the HTTP client, so a client that disconnects mid-request still gets the wallet debited and credited once.
    ```ts
    // the spin is awaited to commit even if the caller never reads the result
    await service.spin('p1', 100);
    expect(client.query).toHaveBeenLastCalledWith('commit');
    ```
    Web: when `spinReels` resolves `{ ok: false, network: true }` and `fetchGameState` resolves balance 900, `expect(await screen.findByText(/Welcome back.*900/)).toBeInTheDocument()`. page.test.tsx: the signed-in Home page passes the balance from `getGameState()` into `GameScreen`.
  - |
    AC9 (web, GameScreen.test.tsx; API, game.service.spec.ts): a balance below the selected bet (for example 60 with bet 100) means the reels do not spin and the bet stays 100.
    ```tsx
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(spinReels).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "100" })).toBeChecked();
    expect(screen.queryByRole("img", { name: /spinning/ })).toBeNull();
    ```
    API: the conditional update returns no row, so `expect(result).toEqual({ ok: false, reason: 'insufficient_balance', balanceCredits: 60 })` and the spy sees `rollback` and no ledger insert.
  - |
    AC10 (web, GameScreen.test.tsx; API, game.controller.spec.ts): balance 100 and bet 250 shows the message and the toast and does not spin.
    ```tsx
    expect(screen.getByText("Your balance of 100 does not cover a bet of 250. Choose a lower bet.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your balance does not cover this bet");
    ```
    API: `await expect(controller.spin(req, { bet: 250 })).rejects.toBeInstanceOf(ConflictException)`.
  - |
    AC11 (API, jackpot.spec.ts): bet 25 rounds each tier to the cent, halves up.
    ```ts
    expect(contributionCents(25)).toEqual({ mini: 50, minor: 38, major: 25, grand: 13 });
    ```
    Also an exhaustive check over all five bets that every tier equals the exact cents rounded with halves up, and a reconciliation test that the pool total equals the sum of the four tiers (`expect(sum(contributionCents(25))).toBe(126)`). Balance edge: a spin with balance exactly equal to the bet (100 and 100) is accepted and leaves balance 0 plus any win. Web: `formatPool(38)` is "0.38".
  - |
    Data (API, game.service.spec.ts or a migration test): migration 003 is additive, so existing wallets and `wallet_entries` rows are untouched and still readable. Assert that applying it twice leaves exactly four `jackpot_pools` rows (the seed is idempotent) with the starting values `{ mini: 200000, minor: 150000, major: 100000, grand: 50000 }`, that a re-run does not reset a grown pool, and that `WalletService.historyFor` still returns existing 'grant', 'bet', 'win' and 'topup' rows unchanged.
  - |
    Rules and wiring (API, game.controller.spec.ts): an unauthenticated `POST /game/spin` is rejected by `SessionGuard`; a bet of 7, `"100"` or `-1` returns 400 and the wallet is never touched; the player id comes from the session, never the body. Web: `shell.test.ts` asserts `expect(PLACE_BET_HREF).toBe(HOME_HREF)`; `BalanceTile.test.tsx` keeps the existing card assertions and adds the `compact` variant.
  - |
    E2E (apps/web/tests/e2e/game.spec.ts): sign in, `await page.getByRole("radio", { name: "250" }).check()`, press Spin, `await expect(page.getByRole("status")).toContainText(/You win|No win this time|does not cover/)`.
assumptions_or_open_questions:
  - |
    DECIDED (reviewer): balance rule. A player may spin when balance equals the bet (`balance >= bet`), per the AC and prototype. `WalletService.placeBet` (strictly greater) does not drive this story and is left untouched; aligning it is a future refactor so platform behaviour is consistent.
  - |
    DECIDED (reviewer): payouts. Keep the placeholder table (two cherries 1x, three bells 10x) behind the replaceable `evaluateSpin` function so the payouts/economy story can change it without touching callers.
  - |
    DECIDED (reviewer): jackpot starting values use the prototype's tier order and values. The prototype's `data-tiers="200000,150000,100000,50000"` is in tier order Mini, Minor, Major, Grand, so Mini 2,000.00, Minor 1,500.00, Major 1,000.00, Grand 500.00 (total 5,000.00). This replaces the earlier reverse order.
  - |
    DECIDED (reviewer): rounding. Pool total is the sum of the four tiers; a 25 bet adds 1.26 (0.50 + 0.38 + 0.25 + 0.13), accepted. The method (integer cents, `Math.floor((bet * 5 * share + 50) / 100)`, half up per tier) is documented in a doc comment on `contributionCents` and in the notes, and tested for all five bets including a sum check, so totals reconcile.
  - |
    DECIDED (reviewer): migration 003 is assumed to be applied by the same mechanism as 001 and 002. This is still unverified by me; the implementer must confirm it during implementation and testing, before release.
  - |
    Prototype inconsistency: `.reel` sets font-size twice (x1.5 with `!important`, then x2). The plan uses x2 via `var(--font-size-xl)`; the x1.5 value may be what was meant to fit 360px. The 1400 ms minimum spin time and 120 ms symbol cycle are not covered by any token, so they are TypeScript constants, not CSS.
  - |
    Prototype nav shows only Home and the game under it, while the current shell also has Wallet, Orders and History. The plan puts the game at `/` for signed-in players and adds no nav entry. A signed-out visitor still sees the existing welcome heading.
  - |
    I did not open how migrations 001 and 002 are applied (runner or script), so the plan assumes 003 is picked up the same way. The implementer should confirm this before adding the file.
  - |
    DECIDED (reviewer): retention and concurrency. `spins` rows are kept indefinitely, with no purge job, until a formal retention policy exists. The concurrency target stays at about 500 concurrent users (ADR-0006); the per-tier `jackpot_pools` row updates serialise per spin, which is fine at that scale. "Live" pool updates for other players' spins are outside this item (the pool refreshes on page load and after the player's own spin).
  - |
    KNOWN LIMITATION (reviewer: no idempotency changes in this story): a retried spin request after a dropped connection could double-spend, since there is no idempotency key. To be addressed in a later hardening/security story. Mitigation within scope: after a network failure the client only re-reads state and never resends the spin automatically.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: migration 003 only adds two tables (`jackpot_pools`, `spins`). Existing `players`, `wallets` and `wallet_entries` rows are not altered; spins reuse the existing ledger kinds 'bet' and 'win', which `002_wallet_entries.sql` already allows.
  - **Backfill / seed**: no backfill. The four tier rows are seeded by `insert ... on conflict (tier) do nothing` at Mini 200000, Minor 150000, Major 100000, Grand 50000 cents (the prototype's values), so re-running is safe and never resets a pool that has already grown.
  - **Settings**: none. No new env var or config file.
  - **Provisioning**: the seeded `jackpot_pools` rows must exist before the first spin; the migration creates them.
  - **Order and rollback**: apply migration 003, then deploy the API, then the web app (the page calls `/game`, which only exists after the API). Rollback: deploy the previous web and API builds; the new tables are unused by old code and can stay in place. Wallet rows changed by spins are ordinary ledger entries and remain valid.

  ### Design source and tokens
  Read in full: `PROD-28OCT-STORY-069-design.html` (four screens: ready, spinning, finished, balance below bet). Tokens already load in `apps/web/src/app/globals.css:2` via `@import "../../../../design-system/tokens.css";` after `@import "tailwindcss";` (line 1), so every new rule uses `var(--token)` names from `design-system/tokens.css` and no literals. The new classes are plain CSS in `globals.css`, consistent with how `.card`, `.alert` and `.shell-*` are already defined there.

  ### Shape of the change
  ```mermaid
  flowchart TD
    Page["app/page.tsx (Home)"] --> Lib["lib/game.ts"]
    Page --> GS["components/game/GameScreen"]
    GS --> RG["ReelGrid"]
    GS --> BS["BetSelector"]
    GS --> JP["JackpotPoolCard"]
    GS --> BT["BalanceTile (compact variant)"]
    Lib -->|"rewrite /api/game*"| NC["next.config.ts"]
    NC --> GC["api game.controller"]
    GC --> Guard["session.guard (existing)"]
    GC --> GSV["api game.service"]
    GSV --> Jk["jackpot.ts"]
    GSV --> Pay["payout.ts"]
    GSV --> DB["database.service (existing)"]
    DB --> Mig["migration 003"]
    DB --> WE["wallet_entries (existing table)"]
    Shell["lib/shell.ts PLACE_BET_HREF"] -.-> Page
    classDef touched fill:#f96,color:#000
    class Page,Lib,GS,RG,BS,JP,BT,NC,GC,GSV,Jk,Pay,Mig,Shell touched
  ```
  Touched nodes are new or modified: `GameService` is the single transaction (why: AC5, AC6, AC7 and AC8 all depend on bet, win, pool and audit committing together); `jackpot.ts` is pure so AC6, AC7 and AC11 are cheap to test; `BalanceTile` is extended rather than duplicated (catalogue reuse rule); `shell.ts` repoints the temporary Play link that History's empty state uses.

  ### Order of work (TDD)
  1. `jackpot.spec.ts` then `jackpot.ts` (AC6, AC7, AC11). 2. `payout.spec.ts` then `payout.ts` (AC3, AC4 seam). 3. `game.service.spec.ts` then migration and service (AC5, AC8, AC9). 4. `game.controller.spec.ts` then controller and module (AC10). 5. `lib/game.test.ts` then `lib/game.ts` and rewrites. 6. Component tests then components and CSS (AC1 to AC4, AC8 to AC10 on the client). 7. `page.test.tsx`, `shell.test.ts`, e2e. Narrow test commands: `cd services/api && pnpm run test -- game` and `cd apps/web && pnpm test -- src/components/game` (API runner is jest, web runner is vitest, per the stack).
review_focus: |
  IN: the game screen, spin transaction, jackpot contribution (5% split 40/30/20/10 in integer cents, half-up, pool total is the sum of tiers so bet 25 adds 1.26 by design), seeded starting pools (Mini 2,000 / Minor 1,500 / Major 1,000 / Grand 500, the prototype's) and the insufficient-balance guard. OUT: real payout amounts and jackpot symbols (only a replaceable `evaluateSpin` placeholder), live multi-player pool updates, nav changes and spin-retry idempotency (a known, accepted double-spend limitation for a later hardening story). Riskiest part is `GameService.spin`: debit, win credit, four pool updates and audit row must commit or roll back together, and the `balance >= bet` condition deliberately differs from `WalletService.placeBet` (strictly greater) because the AC and prototype say "below the bet". The prototype's "Simulate returning" button is a review aid and is intentionally not built.
