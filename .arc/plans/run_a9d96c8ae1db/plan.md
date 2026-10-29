summary: |
  Build the slot game screen on Home: a signed-in player picks a bet (10, 25, 50, 100, 250), presses Spin, sees three reels, a win or loss message, and a live balance. The spin is settled on the server in ONE database transaction (debit the bet, credit any win, add 5% of the bet to the four jackpot tiers 40/30/20/10 in whole cents with halves rounded up, write the ledger rows). Because the result is committed before the response is sent, a dropped connection or closed page still leaves the balance correct on return (AC8). A new Records API `POST /game/spin` plus `GET /game/jackpot` and a new `jackpot_tiers` migration carry the server side. The web side adds `GameScreen`, `ReelGrid`, `BetSelector` and `JackpotPoolCard` and extends `BalanceTile`, following the approved prototype. Payout amounts and jackpot symbols belong to other stories, so payout is a single replaceable seam.

scope:
  - description: |
      Migration `003_jackpot_tiers.sql`: table `jackpot_tiers (tier text primary key check (tier in ('mini','minor','major','grand')), amount_cents bigint not null default 0 check (amount_cents >= 0))`, seeded with the four rows using `insert ... on conflict (tier) do nothing` so it is safe to re-run.
    files:
      - services/api/migrations/003_jackpot_tiers.sql
    rationale: |
      The pool must survive restarts and be shared by all players. Cents in a bigint avoid float drift (AC11 needs exact 0.38 / 0.13 style rounding). The existing migrations (001, 002) use `create table if not exists` and an idempotent seed, and this follows that style.

  - description: |
      Pure game rules, no I/O, so they are unit-testable first. `game.constants.ts` holds `BETS = [10, 25, 50, 100, 250] as const`, `JACKPOT_RATE_PERCENT = 5`, `TIER_SHARES = { mini: 40, minor: 30, major: 20, grand: 10 }` and `SYMBOLS`. `game.rules.ts` holds the contribution split, the reel draw and the payout seam:

      ```ts
      export type Tier = 'mini' | 'minor' | 'major' | 'grand';
      export type Reels = [Symbol, Symbol, Symbol];
      /** Whole cents per tier; half a cent rounds up. */
      export function jackpotContribution(bet: number): Record<Tier, number> {
        // bet * 5% * share, in cents: bet * 100 * 0.05 * share/100 = bet * 5 * share / 100
        const cents = (share: number) => Math.floor((bet * 5 * share + 50) / 100);
        return { mini: cents(40), minor: cents(30), major: cents(20), grand: cents(10) };
      }
      export function drawReels(random: () => number = Math.random): Reels;
      /** PLACEHOLDER seam: the payouts story replaces this table. Returns whole credits won (0 = loss). */
      export function payoutFor(reels: Reels, bet: number): number;
      ```
    files:
      - services/api/src/game/game.constants.ts
      - services/api/src/game/game.rules.ts
      - services/api/src/game/game.rules.spec.ts
    rationale: |
      Keeping the money maths pure and integer-only makes AC6, AC7 and AC11 table-testable. `drawReels` takes an injectable random source so tests can force a win or a loss. `payoutFor` is the one seam the payouts story and the jackpot-symbols story will replace, which keeps this item inside its stated scope.

  - description: |
      `GameService.spin(playerId, bet)` in `services/api/src/game/game.service.ts`. It validates the bet against `BETS`, then runs one transaction on a `PoolClient` (the same pattern as `WalletService.change`):
      1. `update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits`. No row means refuse with `insufficient_balance` and roll back, so nothing is spun, charged or contributed (AC9, AC10).
      2. Insert the `bet` ledger row into `wallet_entries`.
      3. `update jackpot_tiers set amount_cents = amount_cents + $n where tier = $t` for each of the four tiers, using `jackpotContribution(bet)`.
      4. If `payoutFor(...) > 0`, credit the wallet, insert the `win` ledger row and set the final balance.
      5. Commit, then return `{ ok: true, reels, winCredits, balanceCredits, tiersCents }`.

      ```ts
      export type SpinResult =
        | { ok: true; reels: Reels; winCredits: number; balanceCredits: number; tiersCents: Record<Tier, number> }
        | { ok: false; reason: 'invalid_bet' | 'insufficient_balance'; balanceCredits?: number };
      spin(playerId: string, bet: unknown, random?: () => number): Promise<SpinResult>;
      jackpot(): Promise<Record<Tier, number>>;
      ```
    files:
      - services/api/src/game/game.service.ts
      - services/api/src/game/game.service.spec.ts
    rationale: |
      A single transaction is what makes AC8 true. Debit, win, ledger and jackpot either all commit or none do, whether or not the browser is still connected. The wallet row lock already serialises one player's concurrent spins. The `jackpot_tiers` rows serialise all spins briefly, which is acceptable at the ADR-0006 scale of about 500 users.

  - description: |
      `GameController` (`@Controller('game')`, `@UseGuards(SessionGuard)`) with `POST /game/spin` (body `{ bet: number }`) and `GET /game/jackpot`. The player id comes only from `req.player.id`, as in `WalletController`. Responses: 200 with the spin result; 400 for a bet not in `BETS`; 409 for insufficient balance with the message `Your balance of {balance} does not cover a bet of {bet}. Choose a lower bet.`. `GameModule` imports `SessionModule` and `DatabaseModule` as `WalletModule` does, and is added to `AppModule.imports`.
    files:
      - services/api/src/game/game.controller.ts
      - services/api/src/game/game.controller.spec.ts
      - services/api/src/game/game.module.ts
      - services/api/src/app.module.ts
      - services/api/test/game.e2e-spec.ts
    rationale: |
      It mirrors the existing wallet controller and module wiring, so guard and session behaviour is identical. The supertest e2e proves the full HTTP path and the database effects.

  - description: |
      Web data layer. `getJackpot()` is a server-side read, and `spinReels(bet)` is a client-side POST that never throws and returns a discriminated result (`ok`, `insufficient`, `failed`). Both go in a new `apps/web/src/lib/game.ts`, following the style of `lib/session.ts` (`cache: "no-store"`, forwarded cookie). `next.config.ts` gets a rewrite `{ source: "/game/:path*", destination: `${apiUrl}/game/:path*` }`.
    files:
      - apps/web/src/lib/game.ts
      - apps/web/src/lib/game.test.ts
      - apps/web/next.config.ts
    rationale: |
      The browser can only reach the API through the web origin (see the comment at the top of `lib/session.ts`), so a rewrite is required. `/game` is not a page route, so no `/api` prefix is needed.

  - description: |
      UI, built to the approved prototype (`PROD-28OCT-STORY-069-design.html`, screens "ready to spin", "spin in progress", "spin finished", "balance below bet"). The prototype shows a single narrow centred column (`max-width: calc(var(--size-shell-max) / 2)`, `stack-4`) with this order: heading row (h1 "Jackpot slots" and a balance box), the jackpot pool card, three reels, the result message, the bet fieldset, a large primary Spin button, and a toast.
      - `GameScreen` (client component) owns `balance`, `bet`, `phase` (idle, spinning, result, insufficient), `reels`, `result` and `tiersCents`. Before calling the API it checks `balance < bet`. If so it does NOT spin, leaves the bet unchanged, shows `alert-danger` "Your balance of 100 does not cover a bet of 250. Choose a lower bet." and shows the toast (hidden again after 4s) (AC9, AC10). Otherwise it cycles random symbols every 120ms, with a minimum visible spin of about 1.4s, disables the bet fieldset and the Spin button (label "Spinning" with `.spinner`), and keeps the old balance until the response lands. On success it shows the final symbols, then `alert-success` "You win {n}. …" with the check icon, or `alert-info` "No win this time. You bet {bet}. Try again." with the info icon (AC3, AC4), then updates the balance and pool from the response (AC5). On a network failure it calls `router.refresh()` and shows an `alert-info` explaining that the balance reflects any completed spin (AC8); the balance is re-synced from the refreshed server props.
      - `ReelGrid` renders three `.reel` cells with `role="img"` and `aria-label="Reel N"` (or "Reel N spinning" while `is-spinning`).
      - `BetSelector` is a `<fieldset class="bet">` with a `<legend>Bet</legend>` and five radio inputs inside `label.bet-option` (visually hidden input plus a `span`). The radios are a native group, so arrow-key navigation works (AC1).
      - `JackpotPoolCard` is a `.card` with "Jackpot pool", the total (sum of the tiers, formatted `en-US` with two decimals) and a ghost "Show pool split" disclosure button (`aria-expanded`) that toggles a 2-column `<dl class="tiers">` with Mini, Minor, Major and Grand.
      - `BalanceTile` is extended with a `variant="inline"` prop that renders the prototype's right-aligned "Balance" label and large figure with `aria-live="polite"`. The default card variant used by the Wallet page is unchanged. It reuses `formatCredits` or a plain `toLocaleString("en-US")`, so 1000 shows as "1,000".
      - `apps/web/src/app/page.tsx` becomes an async server component: `getSession()`, redirect to `SIGN_IN_HREF` when signed out, then `Promise.all([getWallet(), getJackpot()])` and `<GameScreen balanceCredits=… tiersCents=… />`.
      - `lib/shell.ts`: `PLACE_BET_HREF` changes from `WALLET_HREF` to `HOME_HREF`, because the Play screen now exists (see the TODO comment on that constant).
      - `globals.css` additions, copied from the prototype's `<style>` and styled only with tokens. The existing `.btn`, `.btn-primary`, `.alert-*`, `.card`, `.spinner`, `.stack-*` and `.text-*` rules are already there. New: `.btn-lg` (`--size-control-lg`, `--space-4`, `--font-size-lg`), `.game`, `.game-head`, `.balance-box`, `.jackpot*`, `.tiers`, `.reels`, `.reel` (+ `.is-spinning`), `.result`, `.bet*`, `.bet-option*`, `.spin`, `.toast`. Tokens used: `--size-shell-max`, `--space-1..4`, `--font-size-sm/lg/xl`, `--font-weight-medium/semibold`, `--color-fg`, `--color-fg-muted`, `--color-bg`, `--color-bg-subtle`, `--color-border-strong`, `--color-primary`, `--color-primary-fg`, `--color-focus`, `--border-width`, `--border-width-strong`, `--size-control-lg`, `--size-focus-offset`, `--opacity-disabled`, `--radius-md`, `--radius-lg`, `--size-toast`, `--z-toast`.
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
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/src/app/globals.css
      - apps/web/tests/e2e/mock-session-server.mjs
      - apps/web/tests/e2e/game.spec.ts
      - apps/web/tests/e2e/home.spec.ts
      - apps/web/tests/e2e/top-bar.spec.ts
    rationale: |
      Reuse before new, as the UI guidelines require. `BalanceTile`, `.card`, `.alert-*`, `.btn-primary` / `.btn-ghost`, `.spinner` and the toast pattern are reused or extended. `ReelGrid`, `BetSelector` and `JackpotPoolCard` are the only new components, and the prototype's own plan names exactly these three as NEW. One `.btn-primary` per view (Spin). No `color-accent` is used, as in the prototype.

tests:
  - |
    AC1 (web, vitest, `BetSelector.test.tsx` and `GameScreen.test.tsx`), written first and failing:
    ```tsx
    render(<GameScreen balanceCredits={1000} tiersCents={ZERO_TIERS} />);
    await user.click(screen.getByRole("radio", { name: "250" }));
    expect(screen.getByRole("radio", { name: "250" })).toBeChecked();
    ```
    Also assert that the five options are exactly `10, 25, 50, 100, 250` and that the default selection is 100.
  - |
    AC2 (web, `GameScreen.test.tsx`), with `spinReels` mocked to resolve after the fake-timer delay:
    ```tsx
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(screen.getByRole("img", { name: "Reel 1 spinning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Spinning/ })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByRole("img", { name: "Reel 1" })).toHaveTextContent("🍒");
    expect(spinReels).toHaveBeenCalledWith(100);
    ```
    Server side, in `game.service.spec.ts`, assert that `spin(player, 100, seeded)` returns `reels` of length 3.
  - |
    AC3 (web and API). `GameScreen.test.tsx` with `spinReels` returning `winCredits: 100`:
    ```tsx
    expect(await screen.findByText(/You win 100/)).toBeInTheDocument();
    ```
    `game.service.spec.ts`, with a random source that forces three matching symbols:
    ```ts
    expect(result).toMatchObject({ ok: true, winCredits: expect.any(Number) });
    expect((result as any).winCredits).toBeGreaterThan(0);
    ```
  - |
    AC4 (web and API). `GameScreen.test.tsx` with `winCredits: 0`:
    ```tsx
    expect(await screen.findByText(/No win this time/)).toBeInTheDocument();
    expect(screen.queryByText(/You win/)).toBeNull();
    ```
    `game.service.spec.ts`, with a random source that forces a loss: `expect(result).toMatchObject({ ok: true, winCredits: 0 })`.
  - |
    AC5 (API and web). `game.service.spec.ts` against a test database, with a player at balance 1000 and bet 100: a loss gives `balanceCredits` 900, and a win of W gives `1000 - 100 + W`. Also assert the `wallet_entries` rows: one `bet` row of 100 with `balance_after_credits` 900, and for a win one `win` row of W with the final balance. Web:
    ```tsx
    expect(screen.getByText("Balance").nextElementSibling).toHaveTextContent("1,000"); // before
    // after a loss response with balanceCredits 900
    expect(await screen.findByText("900")).toBeInTheDocument();
    ```
    Also assert that the balance still reads "1,000" while the spin is in progress.
  - |
    AC6 (`game.rules.spec.ts` and `game.service.spec.ts`):
    ```ts
    const c = jackpotContribution(100);
    expect(c.mini + c.minor + c.major + c.grand).toBe(500); // 5.00 in cents
    ```
    Service: read `jackpot_tiers` before and after one spin of 100, and assert the sum of the amounts rose by 500 cents. Web: `JackpotPoolCard` shows the total "5.00" higher after the response (`expect(screen.getByText("5,005.00"))` from a 5,000.00 start).
  - |
    AC7 (`game.rules.spec.ts`, plus the service per-tier row check):
    ```ts
    expect(jackpotContribution(100)).toEqual({ mini: 200, minor: 150, major: 100, grand: 50 });
    ```
    The service spec asserts each `jackpot_tiers` row rose by exactly those cents. A `JackpotPoolCard` test opens "Show pool split" and checks the `Mini`, `Minor`, `Major` and `Grand` values shown as 2.00, 1.50, 1.00 and 0.50 more than before.
  - |
    AC8 (API integration plus web). Service spec: start `spin()` and abandon the caller's promise (nothing waits for or reads the response), then await completion. Then read `balanceFor` from a fresh connection and assert it equals `1000 - bet + win` and that the tiers were incremented. Add a rollback case where the jackpot update is made to throw, and assert that balance, ledger and tiers are all unchanged (all-or-nothing). Web: `spinReels` resolves `{ ok: false, reason: "failed" }`, then
    ```tsx
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText(/balance reflects/i)).toBeInTheDocument();
    ```
    and re-rendering with `balanceCredits={900}` shows 900. Playwright (`game.spec.ts`): reload the page after a spin and assert the balance shown is the post-spin balance.
  - |
    AC9 (web and API). Web: with `balanceCredits={50}` and the default bet 100 (the player's balance fell below the bet after an earlier spin):
    ```tsx
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(spinReels).not.toHaveBeenCalled();
    expect(screen.queryByRole("img", { name: /spinning/ })).toBeNull();
    expect(screen.getByRole("radio", { name: "100" })).toBeChecked();
    ```
    API: `spin(player, 100)` for a balance of 50 returns `{ ok: false, reason: 'insufficient_balance' }`, and the wallet, the ledger and the `jackpot_tiers` rows are all unchanged.
  - |
    AC10 (web, API, and supertest e2e). Web, with balance 100 and bet 250:
    ```tsx
    await user.click(screen.getByRole("radio", { name: "250" }));
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(spinReels).not.toHaveBeenCalled();
    expect(screen.getByText("Your balance of 100 does not cover a bet of 250. Choose a lower bet.")).toBeInTheDocument();
    ```
    Also assert that the toast "Your balance does not cover this bet" has `role="alert"` and disappears after 4s with fake timers. Supertest in `game.e2e-spec.ts`:
    ```ts
    await request(app.getHttpServer()).post('/game/spin').set('Cookie', cookie).send({ bet: 250 }).expect(409);
    ```
    and a signed-out call gets 401, plus `{ bet: 7 }` gets 400.
  - |
    AC11 (`game.rules.spec.ts`), a table test whose values are the exact figures in the criterion:
    ```ts
    expect(jackpotContribution(25)).toEqual({ mini: 50, minor: 38, major: 25, grand: 13 }); // 0.50 / 0.38 / 0.25 / 0.13
    ```
    plus the halves-round-up cases (`25 * 5 * 30 = 3750` gives 37.5, which becomes 38). Service spec: bet 25 raises the `jackpot_tiers` rows by exactly 50, 38, 25 and 13 cents. Formatting test: 38 cents renders as "0.38" and 13 as "0.13".
  - |
    Decisions pinned by tests. Balance boundary: `spin(player, 25)` with balance 25 returns `{ ok: true }` and leaves balance 0 (plus a web test that Spin proceeds when `balanceCredits={25}` and the bet is 25); balance 24 with bet 25 is refused. Seed: after the migration all four `jackpot_tiers.amount_cents` are 0. Rounding discrepancy: a test that the bet 25 tiers sum to 126 cents (not 125) with a comment pointing to the game-economy review. Home: `home.spec.ts` and `top-bar.spec.ts` are rewritten to assert the game screen (heading "Jackpot slots", bet group, Spin button) in place of the old Home title.
  - |
    Data and regression checks. A migration test (or e2e setup step) runs `003_jackpot_tiers.sql` twice and asserts there are still exactly 4 rows, with existing `wallets` and `wallet_entries` rows untouched and readable (`balanceFor` and `historyFor` still return the same values). `WalletController` / `WalletService` specs and the Wallet page (which still uses the card-variant `BalanceTile`) must pass unchanged. `shell.test.ts` is updated for `PLACE_BET_HREF === HOME_HREF`. Narrow commands: `cd services/api && pnpm run test -- game`, and `cd apps/web && pnpm test -- game GameScreen BalanceTile shell`.

assumptions_or_open_questions:
  - |
    DECIDED (reviewer) - win rule. `payoutFor(reels, bet)` is a placeholder for this story. The real payout calculation and game economy belong to a later payout story. Only the interface and flow needed for AC3 and AC4 are built, so gameplay can be validated end to end.
  - |
    DECIDED (reviewer) - balance boundary. A spin is allowed when `balance >= bet` and refused only when `balance < bet` (balance 25 with bet 25 is allowed). `GameService` uses its own `balance_credits >= $2` SQL and does not reuse the strict `canBet` / `placeBet` rule. Not in scope here: the existing free top-up (balance 1 or less) leaves players with 2 to 9 credits unable to cover the minimum bet of 10.
  - |
    DECIDED (reviewer) - jackpot seed. All four tiers start at 0 cents. The prototype's demo figures (2,000.00 / 1,500.00 / 1,000.00 / 500.00) are not used in production logic. Future jackpot configuration can define non-zero seeds.
  - |
    DECIDED (reviewer) - rounding. The AC11 per-tier values are authoritative, and the pool total is the sum of the tiers. For a bet of 25 the rounded tiers sum to 1.26 against an exact 5% of 1.25. This discrepancy is documented in a code comment on `jackpotContribution` and pinned by a test, so it is visible for a future game-economy review.
  - |
    The prototype includes a "Simulate returning after a dropped connection" button and a placeholder outcome cycle. These are design-review demo aids and are NOT built. Real AC8 behaviour is the server-side atomic spin plus the refreshed balance on return.
  - |
    DECIDED (reviewer) - Home page. The game replaces the existing Home content and renders on `/` for a signed-in player (signed-out visitors go to sign-in). There is no new nav entry. `apps/web/tests/e2e/home.spec.ts` and `apps/web/tests/e2e/top-bar.spec.ts` are revised to the new behaviour rather than preserving old Home content expectations. The implementer reads both first, then rewrites only the assertions that depend on the old Home title.
  - |
    The prototype plan says BalanceTile is the balance readout, but its markup is a plain right-aligned "Balance" box, not the existing card (which says "Credit balance" and shows the email). I resolved this with an `inline` variant of `BalanceTile` rather than a new component or changing the Wallet page. Say so if you would prefer a separate component.
  - |
    DECIDED (reviewer) - deferred questions. Concurrent-player handling is covered by the ADR-0006 target of about 500 users, with short row-locked transactions and no extra scaling work. Spin-history retention is out of scope until a dedicated spin-record persistence requirement exists. This plan keeps only the existing append-only `wallet_entries` ledger.
  - |
    Live jackpot updates for other players are not in these acceptance criteria. The pool refreshes on page load and after the player's own spin only.

estimated_points: 8

package_dependencies: []

notes: |
  ### Data & rollout
  - **Existing data**: the migration only adds the new `jackpot_tiers` table. No existing table, column or row changes, so `wallets`, `wallet_entries`, `players` and `sessions` rows stay readable and usable. New `bet` and `win` ledger rows use the existing `kind` values and constraints. `amount_credits >= 1` still holds because a loss writes no `win` row.
  - **Backfill / seed**: the four tier rows are seeded with `insert ... on conflict (tier) do nothing`, so re-running is safe. The starting value is 0 cents per tier (reviewer decision). No backfill is needed.
  - **Settings**: none. There are no new env vars. The bets, the 5% rate and the shares are constants in `game.constants.ts`.
  - **Provisioning**: the migration creates and seeds the table. Run `cd services/api && pnpm run migrate` against each environment.
  - **Order and rollback**: migrate first, then deploy the API, then the web app (the page calls the new `/game/*` endpoints). If the table is missing the API fails fast, so do not deploy the API before migrating. To roll back, redeploy the previous builds. The extra table is harmless and can stay in place, since nothing else reads it.

  ### How this fits the code
  - Money rules live in the pure `game.rules.ts`, and `GameService` only orchestrates the transaction. It copies the transaction shape of `WalletService.change` (`services/api/src/wallet/wallet.service.ts`: begin, conditional UPDATE, ledger insert, commit, rollback on error). It does not call `placeBet` / `recordWin` because those run separate transactions, which would break the all-or-nothing guarantee for AC8.
  - The player id always comes from the session (`SessionGuard`), never the request body. The bet is whitelisted against `BETS` server-side. The client check is only a convenience, and the server is authoritative.
  - Styling is by design tokens only. `globals.css` already imports them (`apps/web/src/app/globals.css` line 2: `@import "../../../../design-system/tokens.css";`), so the new rules just reference `var(--token)` names. No colour or pixel literals are planned. The one literal is the 768px media-query breakpoint that already exists in the shell rules. The prototype's `.reel` font size is `calc(var(--font-size-xl) * 1.5)`, which is derived from a token.
  - Accessibility from the prototype is kept. The result area is `role="status"` with `aria-live="polite"`, the balance has `aria-live="polite"`, the toast is `role="alert"`, reels have `aria-label`s, and the bet group is a native radio fieldset with a visible focus ring.

  ```mermaid
  flowchart TD
    Page["apps/web page.tsx (Home)"] --> GS["GameScreen (new)"]
    GS --> RG["ReelGrid (new)"]
    GS --> BS["BetSelector (new)"]
    GS --> JP["JackpotPoolCard (new)"]
    GS --> BT["BalanceTile inline variant"]
    GS --> LibGame["lib/game.ts spinReels, getJackpot (new)"]
    Page --> Session["lib/session.ts getSession, getWallet (existing)"]
    LibGame -->|"rewrite /game/*"| NextCfg["next.config.ts"]
    NextCfg --> GC["GameController (new)"]
    GC --> Guard["SessionGuard (existing)"]
    GC --> GSvc["GameService (new)"]
    GSvc --> Rules["game.rules.ts (new)"]
    GSvc --> DB["DatabaseService pool (existing)"]
    DB --> Tiers[("jackpot_tiers (new, migration 003)")]
    DB --> Wallets[("wallets, wallet_entries (existing)")]
    AppMod["app.module.ts"] --> GM["GameModule (new)"]
    GM --> GC
    classDef touched fill:#f96,color:#000
    class Page,GS,RG,BS,JP,BT,LibGame,NextCfg,GC,GSvc,Rules,Tiers,AppMod,GM touched
  ```
  Touched nodes are highlighted. `page.tsx` swaps the title for the game, `next.config.ts` forwards `/game/*`, `app.module.ts` registers `GameModule`, and the new API files plus the migration carry the server-side spin. `BalanceTile` gains the inline variant for the prototype's balance readout.

  Untrusted-content note: the work item, deferred questions, current plan and feedback were empty or ordinary requirements. They contained no instructions to read credentials, contact URLs or otherwise act outside the change, so nothing was refused or left out.

review_focus: |
  IN scope: the bet selector, spin, three reels, win and loss message, live balance, and the 5% jackpot contribution split (40/30/20/10 in whole cents, halves up). OUT of scope: the real payout table (the `payoutFor` seam is a placeholder), jackpot symbols and jackpot wins, live pool updates for other players, and any spin-audit table or retention policy. The riskiest part is `GameService.spin`: debit, win, ledger and four tier updates must be one transaction (that is what satisfies AC8), the integer cent rounding must match AC11 exactly, and the balance boundary is the reviewer-decided `balance >= bet` (deliberately different from the existing strict `>` wallet rule), and the 25-bet tiers summing to 1.26 is deliberate and documented. Existing Home e2e expectations are revised, not preserved. The prototype's "Simulate returning" button and its demo outcomes are deliberately not built, and `BalanceTile` is extended with a variant rather than replaced.
