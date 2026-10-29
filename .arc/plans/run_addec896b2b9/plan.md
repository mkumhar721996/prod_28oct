summary: |
  Add the Play game screen (route `/play`) where a signed-in player picks a bet (10, 25, 50, 100, 250), presses Spin, watches three reels and reads a clear win or loss message, with the balance and the jackpot pool updating when the reels stop. The spin is decided and settled entirely on the Records API in ONE database transaction (debit bet, credit any win, ledger rows, 5% jackpot contribution split Mini 40 / Minor 30 / Major 20 / Grand 10 in whole cents with halves rounded up, spin audit row), so a dropped connection or closed page can never leave a half-settled spin and the balance on return is always the completed result (AC8). The web app is a client component built from the approved prototype (BetSelector, ReelGrid, JackpotPoolCard are new; BalanceTile and Toast are extended; Icon, `.card`, `.alert-*`, `.btn-primary`, `.spinner` are reused). Payout amounts and jackpot symbols belong to other stories, so the win rule here is a small, isolated placeholder paytable behind one function that those stories replace.

scope:
  - description: |
      Migration `004_jackpot_pool_and_spins.sql` (idempotent, same style as 002/003): a single-row `jackpot_pool` table holding the four tiers as integer cents, and an append-only `spins` audit table.

      ```sql
      create table if not exists jackpot_pool (
        id smallint primary key check (id = 1),
        mini_cents bigint not null default 0 check (mini_cents >= 0),
        minor_cents bigint not null default 0 check (minor_cents >= 0),
        major_cents bigint not null default 0 check (major_cents >= 0),
        grand_cents bigint not null default 0 check (grand_cents >= 0)
      );
      insert into jackpot_pool (id) values (1) on conflict (id) do nothing;

      create table if not exists spins (
        id bigserial primary key,
        player_id uuid not null references players (id),
        bet_credits integer not null check (bet_credits in (10, 25, 50, 100, 250)),
        win_credits bigint not null default 0 check (win_credits >= 0),
        reels text not null,
        created_at timestamptz not null default now()
      );
      create index if not exists spins_player_created_idx on spins (player_id, created_at desc, id desc);
      ```
      Cents (not float credits) keep the pool exact: 25 x 5% x 30% = 0.375 must store as 0.38, never 0.37999.
    files:
      - services/api/migrations/004_jackpot_pool_and_spins.sql
    rationale: |
      The pool is shared by all players and must survive restarts, and ACs 6, 7 and 11 need exact per-tier amounts. `migrate.ts` already applies every `migrations/*.sql` in name order, so no runner change is needed.

  - description: |
      Pure jackpot maths, written first. Constants file holds the allowed bets and the split. `splitContribution(bet)` returns whole cents per tier, with the half rounded up using integer arithmetic only.

      ```ts
      // game.constants.ts
      export const BETS = [10, 25, 50, 100, 250] as const;
      export type Bet = (typeof BETS)[number];
      export const CONTRIBUTION_PERCENT = 5;
      export const TIER_SHARES = { mini: 40, minor: 30, major: 20, grand: 10 } as const;

      // jackpot.ts  — bet credits x 5% = bet x 5 cents; tier = that x share%, half up
      export type TierCents = { mini: number; minor: number; major: number; grand: number };
      export function splitContribution(bet: number): TierCents {
        const part = (share: number) => Math.floor((bet * CONTRIBUTION_PERCENT * share + 50) / 100);
        return { mini: part(40), minor: part(30), major: part(20), grand: part(10) };
      }
      ```
      bet 100 gives 200/150/100/50 cents (AC7); bet 25 gives 50/38/25/13 cents (AC11), because 37.5 and 12.5 round up.
    files:
      - services/api/src/game/game.constants.ts
      - services/api/src/game/jackpot.ts
      - services/api/src/game/jackpot.spec.ts
    rationale: |
      Isolating the rounding rule makes AC6, AC7 and AC11 testable without a database, and keeps the half-up rule in one place.

  - description: |
      Reels and the placeholder win rule. `reels.ts` exports `SYMBOLS`, `drawReels(randomInt)` (RNG injected so tests are deterministic; production passes `crypto.randomInt`) and `payoutFor(reels, bet)` returning `{ winCredits, label }`.

      ```ts
      export const SYMBOLS = ['cherry', 'bell', 'bar', 'seven'] as const;
      export type Symbol = (typeof SYMBOLS)[number];
      export type Reels = [Symbol, Symbol, Symbol];
      export function drawReels(randomInt: (max: number) => number): Reels;
      export function payoutFor(reels: Reels, bet: number): { winCredits: number; label: string | null };
      ```
      The placeholder paytable mirrors the prototype's script (two cherries pay 1x the bet, three bells pay 10x, anything else pays 0). It is marked with a comment as a stand-in for the payout story and the jackpot-symbols story, which replace `payoutFor`'s body only.
    files:
      - services/api/src/game/reels.ts
      - services/api/src/game/reels.spec.ts
    rationale: |
      AC3 and AC4 need a win and a loss to exist. The real payout table is explicitly another story, so this is the smallest seam that lets both messages be produced and tested.

  - description: |
      `GameService` with `stateFor(playerId)` (balance plus the four tier amounts) and `spin(playerId, bet)`. The spin is one transaction, with the same client/begin/commit/rollback shape as `WalletService.change`. The reels are drawn BEFORE the transaction opens.

      ```ts
      export type SpinRefusal = 'invalid_bet' | 'insufficient_balance';
      export type SpinResult =
        | { ok: true; reels: Reels; bet: number; winCredits: number; label: string | null;
            balanceCredits: number; jackpot: JackpotState }
        | { ok: false; reason: SpinRefusal; balanceCredits?: number };
      spin(playerId: string, bet: unknown, rng?: (max: number) => number): Promise<SpinResult>;
      ```
      Inside the transaction, in this lock order (wallet row, then pool row, so concurrent spins cannot deadlock):
      1. `update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits` (no row means roll back and return `insufficient_balance`).
      2. Insert the `bet` row into `wallet_entries` with the balance after the bet.
      3. If `winCredits > 0`: credit the wallet and insert the `win` ledger row (the table requires amount >= 1, so a loss writes no win row).
      4. `update jackpot_pool set mini_cents = mini_cents + $1, minor_cents = minor_cents + $2, major_cents = major_cents + $3, grand_cents = grand_cents + $4 where id = 1 returning *` using `splitContribution(bet)`.
      5. Insert the `spins` row, then commit.
      `bet` must be one of `BETS` (not 0, not a string, not 7) or the result is `invalid_bet` before any SQL runs.
    files:
      - services/api/src/game/game.service.ts
      - services/api/src/game/game.service.spec.ts
    rationale: |
      A single server-side transaction is what makes AC5 exact (1000 - bet + win) and AC8 true by construction: nothing the browser does after sending the request can stop the debit, the win and the pool contribution committing together. The refusal predicate lives in SQL (not read-then-write), so two tabs cannot overspend. Spins serialise on the one pool row; that is fine at the ~500-user scale in ADR-0006.

  - description: |
      `GameController` (session-guarded exactly like `WalletController`; the player id comes from the session, never the body) plus module wiring.

      ```ts
      @Controller('game') @UseGuards(SessionGuard)
      GET  /game       -> { balanceCredits, jackpot: { miniCents, minorCents, majorCents, grandCents, totalCents } }
      POST /game/spin  body { bet } -> 200 { reels, bet, winCredits, label, balanceCredits, jackpot }
                       invalid bet  -> 400 BadRequestException
                       insufficient -> 409 ConflictException({ message, balanceCredits })
      ```
      The 409 message reads "Your balance of {balance} does not cover a bet of {bet}. Choose a lower bet." (the design's wording, AC10). `GameModule` imports `SessionModule` (the Database module is already global, as `WalletModule` shows) and is added to `AppModule.imports`.
    files:
      - services/api/src/game/game.controller.ts
      - services/api/src/game/game.controller.spec.ts
      - services/api/src/game/game.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Mirrors the existing wallet module layout (controller, service, module, specs beside them) so the API stays consistent.

  - description: |
      Wallet bet rule: `WalletService.placeBet` currently requires a balance STRICTLY greater than the bet (`balance_credits > $2`); change it so a player may wager their full balance.

      ```ts
      // before
      'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits > $2 returning balance_credits'
      // after
      'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits'
      ```
      Update `wallet.service.spec.ts` (the `balance_credits > \$2` regex and the "accepts a bet that leaves 1 credit" case; add "accepts a bet equal to the balance and leaves 0"), and the doc comment on `placeBet`. `canBet` and `claimTopUp` are left alone (see the decided note on top-up eligibility).
    files:
      - services/api/src/wallet/wallet.service.ts
      - services/api/src/wallet/wallet.service.spec.ts
    rationale: |
      The reviewer decided a player may wager their whole balance. `GameService.spin` uses the same `>=` predicate, so the two bet paths agree. The `wallet_entries.balance_after_credits >= 0` check already allows a balance of 0.

  - description: |
      Records API end-to-end spec against a real PostgreSQL, modelled on `wallet.e2e-spec.ts` (register an agent, then drive HTTP). It resets the pool in `beforeEach` (`update jackpot_pool set mini_cents = 0, ...`; the existing `truncate ... players cascade` clears `spins` through the foreign key).
    files:
      - services/api/test/game.e2e-spec.ts
    rationale: |
      Unit specs mock the pool, so only a real database proves the transaction atomicity, the ledger rows and the pool arithmetic (ACs 5, 6, 7, 8, 10, 11).

  - description: |
      Web client library `lib/game.ts`: the server-side loader, the client-side spin call and the pure presentation helpers. Add the rewrite `{ source: "/api/game/spin", destination: `${apiUrl}/game/spin` }` to `next.config.ts` (under /api for the same reason as the others: `/play` is the page).

      ```ts
      export const BETS = [10, 25, 50, 100, 250] as const;
      export type JackpotCents = { miniCents: number; minorCents: number; majorCents: number; grandCents: number; totalCents: number };
      export type GameState = { balanceCredits: number; jackpot: JackpotCents };
      export type SpinOutcome =
        | { ok: true; reels: string[]; bet: number; winCredits: number; label: string | null; balanceCredits: number; jackpot: JackpotCents }
        | { ok: false; kind: 'insufficient' | 'failed'; message?: string };
      export function getGame(): Promise<GameState>;              // server side, throws on failure, like getWallet
      export function spinOnce(bet: number): Promise<SpinOutcome>; // client side, never throws
      export const formatCents = (cents: number) => (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      export function resultMessage(o: { bet: number; winCredits: number; label: string | null }): { tone: 'success' | 'info'; text: string };
      export const canCover = (balance: number, bet: number) => balance >= bet;
      ```
      Win text is "You win {n}. {label}" and loss text is "No win this time. You bet {bet}. Try again." (the prototype's copy).
    files:
      - apps/web/src/lib/game.ts
      - apps/web/src/lib/game.test.ts
      - apps/web/next.config.ts
    rationale: |
      Follows the `lib/session.ts` split (server loader forwards the cookie; browser calls go through a rewrite). Putting money formatting and message copy in pure functions makes ACs 3, 4, 11 and the insufficient message testable without rendering.

  - description: |
      Components under `apps/web/src/components/game/`, taken from the prototype's "Game screen" states (ready, spinning, finished, balance below bet).

      - `BetSelector` (NEW): a `<fieldset class="bet">` with `<legend>Bet</legend>` and five radio inputs inside `.bet-option` labels (the prototype's segmented buttons); props `{ value, onChange, disabled }`. Native radios give arrow-key support, the focus ring and the checked state for free.
      - `ReelGrid` (NEW): three `.reel` divs with `role="img"` and `aria-label` "Reel N" (or "Reel N spinning"); a spinning reel shows `?` or cycling symbols and gets `.is-spinning`. Symbols render as 🍒 🔔 BAR 7.
      - `JackpotPoolCard` (NEW): `.card.jackpot` with the "Jackpot pool" label, the total in `.jackpot-total`, and a `.btn.btn-ghost.btn-sm` "Show pool split" that toggles the `dl.tiers` of Mini, Minor, Major and Grand (`aria-expanded` kept in sync).
      - `GameScreen` (NEW, `"use client"`): `{ initial: GameState }`. It holds `balance`, `bet` (default 100), `jackpot`, `phase` ('idle' | 'spinning' | 'result') and the result. The result region is `role="status" aria-live="polite"` with `.alert-success` (check icon), `.alert-info` (info icon) or `.alert-danger` (alert icon). Spin flow: if `!canCover(balance, bet)` it does NOT spin, shows the danger alert "Your balance of {balance} does not cover a bet of {bet}. Choose a lower bet.", shows the Toast for 4 s and leaves the bet unchanged (AC9, AC10). Otherwise it sets `phase='spinning'`, disables the fieldset and button (button shows `.spinner` and "Spinning"), cycles symbols every 120 ms, and waits for BOTH `spinOnce(bet)` and a minimum 1400 ms (the prototype's pacing). It then stops the reels on the server's symbols and updates balance and pool together. The balance keeps its pre-spin value until the reels stop.
      - Dropped connection: before the request it writes a `localStorage` flag; on mount, if the flag is set, it clears it and shows the prototype's info alert "Welcome back. Your last spin finished while you were away, and your balance shows {balance}." (AC8). If the request itself fails it shows a danger alert "We couldn't confirm that spin. Your balance below is up to date." and calls `router.refresh()`.
      - Reuse: `Icon` (check, info, alert, already in the sprite), `Toast`, `formatCredits`, `.spinner`, `.card`, `.alert-*`, `.btn-primary btn-lg`. The prototype's "Simulate returning after a dropped connection" button is a review aid only and is NOT built.
      - `BalanceTile` is EXTENDED with `variant?: "card" | "inline"` (default "card", so the Wallet page is untouched). "inline" renders the prototype's `.balance-box` (muted "Balance" label, `<strong aria-live="polite">`).
      - `Toast` is EXTENDED with optional `icon?: IconName` (default "check") and `role?` (the insufficient toast uses the alert icon and `role="alert"`, as in the prototype).
    files:
      - apps/web/src/components/game/BetSelector.tsx
      - apps/web/src/components/game/BetSelector.test.tsx
      - apps/web/src/components/game/ReelGrid.tsx
      - apps/web/src/components/game/ReelGrid.test.tsx
      - apps/web/src/components/game/JackpotPoolCard.tsx
      - apps/web/src/components/game/JackpotPoolCard.test.tsx
      - apps/web/src/components/game/GameScreen.tsx
      - apps/web/src/components/game/GameScreen.test.tsx
      - apps/web/src/components/BalanceTile.tsx
      - apps/web/src/components/BalanceTile.test.tsx
      - apps/web/src/components/appointments/Toast.tsx
    rationale: |
      The catalogue already covers the balance readout and the toast, so those are extended, not duplicated. The reel grid, bet selector and pool card have no catalogue equivalent, and the prototype itself marks exactly those three as new.

  - description: |
      Route and navigation. `app/play/page.tsx` is a server component: `getSession()` then `redirect('/sign-in?next=play')` when signed out, otherwise `getGame()` and `<GameScreen initial={state} />`. It also gets a `loading.tsx` skeleton built on `.skeleton`, as `wallet/loading.tsx` does. In `lib/shell.ts`:

      ```ts
      export const PLAY_HREF = "/play";
      export const PLACE_BET_HREF = PLAY_HREF; // was WALLET_HREF; the History empty state's "Place a bet" now lands on the game
      // NEXT_TARGETS gains: play: PLAY_HREF
      // MAIN_NAV gains, at the END: { key: "play", label: "Play", href: PLAY_HREF }
      ```
    files:
      - apps/web/src/app/play/page.tsx
      - apps/web/src/app/play/page.test.tsx
      - apps/web/src/app/play/loading.tsx
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      `shell.ts` itself says PLACE_BET_HREF is temporary until the Play screen ships. The UI guidelines say to append new sections to the end of the nav so existing positions stay stable. `shell.test.ts` currently pins `PLACE_BET_HREF` to `WALLET_HREF` and lists the nav keys, so both assertions change.

  - description: |
      Styling in `apps/web/src/app/globals.css`, in a new "Game screen (from the approved prototype)" block. The tokens already load via `@import "../../../../design-system/tokens.css"` (globals.css line 2), so the block only references tokens. Copy the prototype's rules for `.game` (max-width `calc(var(--size-shell-max) / 2)`), `.game-head`, `.balance-box`, `.jackpot`, `.jackpot-top`, `.jackpot-total`, `.tiers`, `.reels`, `.reel`, `.reel.is-spinning`, `.result`, `.bet`, `.bet-options`, `.bet-option`, and `.spin`. Add `.btn-lg` and `.alert-info .btn`-free variants only if not already present (`.btn-lg` is missing today). Tokens used: `--space-1/2/3/4`, `--radius-md/lg`, `--font-size-sm/xl`, `--font-weight-medium/semibold`, `--color-bg`, `--color-bg-subtle`, `--color-border-strong`, `--color-primary`, `--color-primary-fg`, `--color-fg-muted`, `--color-focus`, `--border-width`, `--border-width-strong`, `--size-control-lg`, `--size-focus-offset`, `--size-shell-max`, `--opacity-disabled`. No hex, rgb or px literals. The reel font size is `calc(var(--font-size-xl) * 1.5)`; the prototype declares it twice (1.5 with !important, then 2), and the effective value is 1.5.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      The app keeps one global stylesheet that copies prototype rules (see the existing "Orders", "Appointments" blocks), so the game follows that convention instead of introducing CSS modules.

  - description: |
      Browser e2e. Extend the mock API (`mock-session-server.mjs`) with `GET /game` and `POST /game/spin` (in-memory balance and pool, scripted win then loss, 409 when the balance is below the bet) and add `play.spec.ts`. It covers: pick 250 and the radio is checked; Spin shows reels, a result message and a changed balance; the insufficient case with balance 100 and bet 250 (reels unchanged, message shown, bet still 250); reload after a spin shows the settled balance.
    files:
      - apps/web/tests/e2e/mock-session-server.mjs
      - apps/web/tests/e2e/play.spec.ts
    rationale: |
      Playwright is the web app's confirmed E2E tool, and the existing specs already run against this mock API.

tests:
  - |
    AC1 (write first, fails until BetSelector and GameScreen exist). Selecting 250 shows 250 as the selected bet. In `BetSelector.test.tsx` and `GameScreen.test.tsx` (vitest + testing library, as in the existing component tests):
    ```ts
    render(<GameScreen initial={{ balanceCredits: 1000, jackpot }} />);
    await user.click(screen.getByRole('radio', { name: '250' }));
    expect(screen.getByRole('radio', { name: '250' })).toBeChecked();
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['10', '25', '50', '100', '250']);
    ```
    Also assert the default is 100: `expect(screen.getByRole('radio', { name: '100' })).toBeChecked()`.
  - |
    AC2. Pressing Spin with bet 100 spins three reels and then shows their symbols. In `GameScreen.test.tsx` with `vi.useFakeTimers()` and `spinOnce` mocked to resolve `{ ok: true, reels: ['cherry','cherry','bar'], bet: 100, winCredits: 100, ... }`:
    ```ts
    await user.click(screen.getByRole('button', { name: 'Spin' }));
    expect(screen.getAllByRole('img', { name: /Reel \d spinning/ })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Spinning/ })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(1400));
    expect(screen.getAllByRole('img', { name: /^Reel \d$/ }).map((r) => r.textContent)).toEqual(['🍒', '🍒', 'BAR']);
    expect(spinOnce).toHaveBeenCalledWith(100);
    ```
    API side, `reels.spec.ts`: `expect(drawReels(() => 0)).toEqual(['cherry','cherry','cherry'])` and every drawn symbol is in `SYMBOLS`.
  - |
    AC3. A finished spin with a win shows a win message. `game.test.ts` and `GameScreen.test.tsx`:
    ```ts
    expect(resultMessage({ bet: 100, winCredits: 100, label: 'Two cherries pay 1× your bet.' }))
      .toEqual({ tone: 'success', text: 'You win 100. Two cherries pay 1× your bet.' });
    expect(await screen.findByText(/You win 100/)).toBeInTheDocument();
    ```
    API side, `reels.spec.ts`: `expect(payoutFor(['cherry','cherry','bar'], 100)).toEqual({ winCredits: 100, label: 'Two cherries pay 1× your bet.' })`.
  - |
    AC4. A finished spin with no win shows a loss message. `game.test.ts` and `GameScreen.test.tsx`:
    ```ts
    expect(resultMessage({ bet: 100, winCredits: 0, label: null }))
      .toEqual({ tone: 'info', text: 'No win this time. You bet 100. Try again.' });
    expect(await screen.findByText(/No win this time/)).toBeInTheDocument();
    ```
    The loss is also a distinct alert class, so the two messages are not told apart by colour alone: the text differs and each has its own icon.
  - |
    AC5. Balance after a spin is the balance minus the bet plus any win. API unit (`game.service.spec.ts`, mocked pool in the style of `wallet.service.spec.ts`) for a loss and a win:
    ```ts
    // loss: 1000 - 100
    expect(await service.spin('p1', 100, () => 0 /* arranged losing reels */)).toMatchObject({ ok: true, winCredits: 0, balanceCredits: 900 });
    // win of 100 on a bet of 100
    expect(result).toMatchObject({ ok: true, winCredits: 100, balanceCredits: 1000 });
    expect(sqlOf(calls)).toEqual(['begin', /^update wallets/, /^insert into wallet_entries/, /^update wallets/, /^insert into wallet_entries/, /^update jackpot_pool/, /^insert into spins/, 'commit']);
    ```
    Real-database check in `game.e2e-spec.ts`: register, `POST /game/spin {bet:100}`, then `expect(res.body.balanceCredits).toBe(1000 - 100 + res.body.winCredits)` and `GET /wallet` returns the same number. Web: after the spin resolves, `expect(screen.getByText('900')).toBeInTheDocument()` in the Balance readout, and before it resolves the readout still shows `1,000`.
  - |
    AC6. A bet of 100 raises the pool total by 5. `jackpot.spec.ts` plus e2e:
    ```ts
    const t = splitContribution(100);
    expect(t.mini + t.minor + t.major + t.grand).toBe(500); // cents = 5.00
    ```
    e2e: `GET /game` before and after a bet-100 spin, `expect(after.jackpot.totalCents - before.jackpot.totalCents).toBe(500)`. Web: `JackpotPoolCard` renders `formatCents(totalCents)` and `GameScreen` shows the new total after the spin (`5.00` more).
  - |
    AC7. A bet of 100 raises Mini, Minor, Major and Grand by 2, 1.5, 1 and 0.5. `jackpot.spec.ts`:
    ```ts
    expect(splitContribution(100)).toEqual({ mini: 200, minor: 150, major: 100, grand: 50 });
    ```
    `game.service.spec.ts` asserts the `update jackpot_pool` params are `[200, 150, 100, 50]`. e2e asserts each tier column moved by exactly those cents. Web: with the split toggled open, `JackpotPoolCard` shows `2.00`, `1.50`, `1.00`, `0.50` increments (rendered tier values, e.g. `expect(screen.getByText('1.50')).toBeVisible()`).
  - |
    AC8. A spin that is in flight when the connection drops or the page closes still shows the completed result on return. API (the substantive guarantee), `game.e2e-spec.ts`: send a spin and discard the response (`request(...).timeout(...)`/abort on the client side), then `GET /game` and assert `balanceCredits` equals `1000 - 100 + win` and the `spins` and `wallet_entries` rows exist. Atomicity in `game.service.spec.ts`: when the jackpot update throws, the sequence ends `rollback` and the wallet is NOT debited (`expect(sqlOf(calls).at(-1)).toBe('rollback')`; no `commit` call). Web: with `localStorage` flagged, mounting `GameScreen` shows `expect(screen.getByText(/Welcome back/)).toBeInTheDocument()` containing the server-rendered balance, and clears the flag; when `spinOnce` returns `{ ok: false, kind: 'failed' }` the failure alert shows and `router.refresh` is called.
  - |
    AC9. A balance below the selected bet means no spin and the bet stays. `GameScreen.test.tsx`, balance 90 and bet 100 selected:
    ```ts
    await user.click(screen.getByRole('button', { name: 'Spin' }));
    expect(spinOnce).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: /spinning/ })).toBeNull();
    expect(screen.getByRole('radio', { name: '100' })).toBeChecked();
    ```
    API: `game.service.spec.ts` with the wallet update returning no row gives `{ ok: false, reason: 'insufficient_balance' }` and a `rollback` with no `insert into spins`. Boundary (decided: full balance may be wagered): balance 100 with bet 100 DOES spin and ends at `0 + win`; in `GameScreen.test.tsx` `expect(canCover(100, 100)).toBe(true)` and `expect(canCover(99, 100)).toBe(false)`; in `wallet.service.spec.ts` `placeBet('p1', 100)` with a balance of 100 returns `{ ok: true, balanceCredits: 0 }`.
  - |
    AC10. Balance 100 and bet 250 means no spin and a message that the balance does not cover the bet. `GameScreen.test.tsx`:
    ```ts
    render(<GameScreen initial={{ balanceCredits: 100, jackpot }} />);
    await user.click(screen.getByRole('radio', { name: '250' }));
    await user.click(screen.getByRole('button', { name: 'Spin' }));
    expect(screen.getByRole('status')).toHaveTextContent('Your balance of 100 does not cover a bet of 250. Choose a lower bet.');
    expect(screen.getByRole('alert')).toHaveTextContent('Your balance does not cover this bet'); // toast
    expect(spinOnce).not.toHaveBeenCalled();
    ```
    e2e: `POST /game/spin {bet:250}` for a player with 100 gives `409` and `message` matching `/does not cover a bet of 250/`, and the wallet is still 100 with no new `wallet_entries` or `spins` row. `Toast` test: it calls `onHide` after `TOAST_MS`.
  - |
    AC11. A bet of 25 raises the tiers by 0.50, 0.38, 0.25 and 0.13, each rounded to the cent with halves up. `jackpot.spec.ts`:
    ```ts
    expect(splitContribution(25)).toEqual({ mini: 50, minor: 38, major: 25, grand: 13 });
    expect(formatCents(38)).toBe('0.38');
    ```
    The table also covers 10 (`{ mini: 20, minor: 15, major: 10, grand: 5 }`), 50 and 250, and a property check that no tier is ever rounded down on a half. e2e: spin with bet 25 and assert the four columns moved by 50, 38, 25 and 13 cents.
  - |
    Supporting tests: `game.controller.spec.ts` (400 for `{bet: 7}`, `{bet: '100'}` and a missing body; 401 without a session, as in `wallet.controller.spec.ts`; the player id comes from `req.player.id` not the body). `play/page.test.tsx` (signed-out visitor is redirected to `/sign-in?next=play` and `getGame` is not called; signed-in renders the game with the balance). `shell.test.ts` (`PLACE_BET_HREF` is `/play`; `MAIN_NAV.at(-1)` is Play and earlier positions are unchanged; `signInTarget('play')` is `/play`). `BalanceTile.test.tsx` (the default "card" output is unchanged, so the Wallet page test still passes; "inline" renders the `.balance-box`). Playwright `play.spec.ts` as described in scope. Narrow commands: `(cd services/api && pnpm run test -- game)`, `(cd apps/web && pnpm test -- src/components/game src/lib/game.test.ts src/lib/shell.test.ts src/app/play)`; the API e2e runs with its existing e2e script against a throwaway `DATABASE_URL`.

assumptions_or_open_questions:
  - |
    DECIDED by the reviewer: a player may wager their full balance (balance >= bet). `GameService.spin` and the web `canCover` helper use `>=`, and `WalletService.placeBet` is changed from `balance_credits > $2` to `balance_credits >= $2` (with its spec) so the two stay consistent. `canBet` and the free top-up rule (`balance <= 1`) are NOT changed: they are the wallet story's top-up eligibility, not the bet rule, and the reviewer did not ask for that. Side effect to be aware of: a player left with 2 to 9 credits can afford no bet (the smallest is 10) and is not yet eligible for a top-up. That is a wallet-story question, not part of this item.
  - |
    DECIDED by the reviewer: the jackpot tiers are seeded at 0. The prototype's 2,000.00 / 1,500.00 / 1,000.00 / 500.00 are demo data only.
  - |
    DECIDED by the reviewer: the win rule is the placeholder `payoutFor()` (two cherries pay 1x, three bells pay 10x, copied from the prototype's script). The final payout model is deferred to the payout and jackpot-symbols stories, which replace the body of `payoutFor` in `reels.ts`; the transaction, ledger rows and UI do not change. Nothing in this item pays a jackpot out of the pool.
  - |
    ASSUMPTION: the reels and the win are decided on the server (`crypto.randomInt`), never by the browser, so a player cannot choose their outcome and AC8 holds even if the client disappears mid-spin. The web only animates and then shows the server's symbols.
  - |
    DECIDED by the reviewer (design vs navigation): keep the existing application navigation and integrate the game into it, not the prototype's Home-only top bar. The game is its own `/play` route and a "Play" entry is appended to the END of `MAIN_NAV`, so Home, Wallet, Orders, History and Appointments keep their positions. Only the prototype's game-screen content (not its Home-only nav) is built.
  - |
    ASSUMPTION (design vs component list): the prototype's design notes list `BalanceTile` for the balance readout, but its markup is a compact `.balance-box` in the page header, not the Wallet page's large card. The plan therefore extends `BalanceTile` with an `inline` variant instead of building a second balance component.
  - |
    ASSUMPTION: the prototype's "Simulate returning after a dropped connection" button is a review aid, not a product feature. In production the same "Welcome back" notice is shown on the next visit when a `localStorage` flag set before the spin request is still present. The flag only controls that notice; the balance itself always comes from the server.
  - |
    DEFERRED, does not block this story: how long spin and payout audit records are kept. This plan stores one `spins` row per spin forever (no purge job) and does not decide a retention period; the ledger in `wallet_entries` is already never deleted. Confirm the period before a purge or archive job is built.
  - |
    DEFERRED, does not block this story: how many concurrent players the game and live jackpot must support. The design here is per-request (the page loads the pool on open and updates it from each spin response); there is no live push. All spins update one `jackpot_pool` row, so they serialise on it. That is fine at the ADR-0006 scale of up to about 500 users, but a higher target would need the pool split across rows or moved off the hot path.
  - |
    ASSUMPTION: the pool counts whole cents, so the four tier contributions can sum to a cent more or less than exactly 5% of the bet (bet 25 contributes 0.50 + 0.38 + 0.25 + 0.13 = 1.26 against a 1.25 target), as AC11 requires. The plan implements the per-tier rounding the AC spells out and does not reconcile the extra cent.
  - |
    Nothing in the work item or the attached context asked for anything outside this change (no credentials, files outside the repo, network calls, pushes or disabled checks), so no part of the item text was set aside.

estimated_points: 8

package_dependencies: []

notes: |
  ### Data & rollout

  - **Existing data**: migration `004` only ADDS two tables (`jackpot_pool`, `spins`); it alters no existing table or row. `wallets`, `wallet_entries` and their history keep working untouched, and spins write the same `bet` and `win` ledger kinds that the History screen already renders, so earlier entries and new ones sit in one list.
  - **Backfill / seed**: no backfill. The system needs ONE seeded row, `jackpot_pool(id = 1)`, created by the migration itself with `insert ... on conflict (id) do nothing`, so the whole file is idempotent and safe to re-run (as `migrate.ts` does on every run). Seed value is 0 (see the open question on a starting pool).
  - **Settings**: none. No new env var or config file (the bet list, the 5% and the 40/30/20/10 split are code constants in `game.constants.ts`).
  - **Provisioning**: nothing outside the database. Run `cd services/api && pnpm run migrate` against each environment (staging, then prod) before the new API code is deployed.
  - **Order and rollback**: migrate first (additive, so the old API ignores the new tables), then deploy the API, then the web app. Rollback is to redeploy the previous web and API builds; the new tables can stay in place unused. Spin ledger rows already written remain valid wallet history. A down migration is not provided because dropping `spins` would delete audit records.

  The migration test requirement for data changes is covered by the e2e spec: it truncates and re-applies, and asserts an existing player's `wallet_entries` (the 1,000 `grant` row) is still read correctly by `GET /wallet` and `GET /wallet/history` after `004` runs.

  ### Design source

  Everything UI here is read from the approved prototype `PROD-28OCT-STORY-069-design.html`: the single centred column `.game` (max width half of `--size-shell-max`); header row with "Jackpot slots" `h1` and the balance readout; the `.card.jackpot` pool card with the "Show pool split" ghost button and 2x2 `.tiers` grid; three square `.reel` tiles in a 3-column grid; the `.result` live region; the `fieldset.bet` with five radio "segments"; the full-width `.btn.btn-primary.btn-lg.spin`; and the toast "Your balance does not cover this bet". Its four screens are the four states built: ready, spinning (bet and Spin disabled, `.spinner`, reels dashed with `?`), finished (success or info alert), and balance below bet (danger alert plus toast). The design uses no accent colour; neither does the plan. One primary button per view (Spin), per the UI guidelines.

  Tokens load in the app through `apps/web/src/app/globals.css` line 2 (`@import "../../../../design-system/tokens.css"`) after `@import "tailwindcss"` at line 1, so no loader work is needed. Components use the plain class names from that stylesheet (not Tailwind utilities), as the existing screens do.

  ### Request flow and touched modules

  ```mermaid
  flowchart TD
    subgraph Web["apps/web"]
      Page["app/play/page.tsx"]
      Screen["components/game/GameScreen.tsx"]
      Bet["BetSelector"]
      Reels["ReelGrid"]
      Pool["JackpotPoolCard"]
      Bal["BalanceTile (inline variant)"]
      Toast["appointments/Toast.tsx"]
      Lib["lib/game.ts"]
      Shell["lib/shell.ts"]
      Next["next.config.ts rewrite"]
      Session["lib/session.ts (getSession)"]
    end
    subgraph Api["services/api"]
      Ctl["game/game.controller.ts"]
      Svc["game/game.service.ts"]
      Jp["game/jackpot.ts"]
      Rl["game/reels.ts"]
      Guard["session/session.guard.ts"]
      Db["database/database.service.ts"]
      Mig["migrations/004_jackpot_pool_and_spins.sql"]
      Wallet["wallet/wallet.service.ts (placeBet predicate >=)"]
    end
    Page -->|getSession, getGame| Session
    Page --> Screen
    Screen --> Bet
    Screen --> Reels
    Screen --> Pool
    Screen --> Bal
    Screen --> Toast
    Screen -->|spinOnce| Lib
    Lib --> Next
    Next -->|POST /game/spin| Ctl
    Lib -->|GET /game| Ctl
    Ctl --> Guard
    Ctl --> Svc
    Svc --> Jp
    Svc --> Rl
    Svc --> Db
    Db --> Mig
    Svc -.same ledger tables.-> Wallet
    Shell -->|PLACE_BET_HREF, nav entry| Page
    classDef touched fill:#f96,color:#000
    class Page,Screen,Bet,Reels,Pool,Bal,Toast,Lib,Shell,Next,Ctl,Svc,Jp,Rl,Mig,Wallet touched
  ```
  Touched nodes (orange) are new or edited. `WalletService` changes only its `placeBet` predicate (`>` to `>=`). `GameService` still writes the same `wallets` and `wallet_entries` rows itself, in its own transaction, because `WalletService.change` opens and commits its own transaction and so cannot be composed with the pool update and the spin row. The AppModule edit (importing `GameModule`) is not drawn.

  ### Ordering for the implementer (TDD)

  1. `jackpot.spec.ts` (AC6, 7, 11), then `jackpot.ts` and constants. 2. `reels.spec.ts` (AC2, 3, 4 server side), then `reels.ts`. 3. `game.service.spec.ts` (AC5, 8, 9, 10), then the migration and `game.service.ts`. 4. `game.controller.spec.ts`, then controller and module wiring. 5. `game.e2e-spec.ts` against a real database. 6. Web: `game.test.ts`, then `lib/game.ts` and the rewrite; `BetSelector`, `ReelGrid`, `JackpotPoolCard` tests then components; `BalanceTile` and `Toast` extensions; `GameScreen` tests then component; `shell` tests then `shell.ts`; `play` page test then page and `loading.tsx`; CSS; the Playwright mock and spec last.

review_focus: |
  IN scope: bet selection, the spin, the three reels, win/loss message, live balance, the 5% jackpot contribution (40/30/20/10, whole cents, halves up), and the insufficient-balance refusal. OUT: real payout amounts and jackpot symbols (the win rule in `reels.ts` is a deliberate placeholder behind one function), paying out of the pool, and any live push of the pool. Riskiest part is `GameService.spin`: the single transaction (wallet debit, ledger rows, pool update, spin row) and its lock order, plus the cent-rounding in `splitContribution`. Deliberate choices a reviewer should not flag: the spin is settled server-side so AC8 holds by construction; balance equal to the bet IS allowed (reviewer decision), so `placeBet` is changed from `>` to `>=` too while `canBet` and the top-up rule stay as they are; the pool seed is 0; `payoutFor()` is the agreed placeholder; and the game lives at `/play` with a "Play" entry appended to the existing nav (reviewer decision), not the prototype's Home-only nav.
