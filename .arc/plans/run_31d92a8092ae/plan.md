summary: |
  Most of the free top-up already exists: `GET /wallet` reports `topUp.eligible = !canBet(balance)`, `POST /wallet/top-up` runs one conditional UPDATE (`balance_credits <= 1`) so concurrent claims serialise, there is no cooldown or cap, and `ClaimCreditsPanel` is on the Wallet page. Two gaps remain against the acceptance criteria and the approved prototype. (1) AC6 needs a claim of 1 credit to give 1,001, but the default top-up is 500 (`DEFAULT_TOP_UP_CREDITS`), so it becomes 1,000. (2) The prototype offers the claim only when the balance is 1 or less (AC1-3). The current panel always renders a disabled "Claim free credits" button plus an Available/Not available badge. The plan changes the default and then re-shapes the panel to the prototype: no claim control at a balance of 2 or more, a primary "Claim free top-up" button when low, and toast outcomes. It also adds API tests for the refusal, repeat-claim and simultaneous-claim criteria (AC4, 5, 7, 8, 9).
scope:
  - description: |
      API default top-up 500 -> 1,000 (AC6). In `wallet.config.ts` set `DEFAULT_TOP_UP_CREDITS = 1000` and update `INVALID_TOP_UP_WARNING` to say "Falling back to default value: 1000." plus the doc comment. `WALLET_TOP_UP_CREDITS` stays as the override, so the game economy owner can change the amount without a code change. Update the `WALLET_TOP_UP_CREDITS` row in `services/api/README.md` (default 1000, fallback 1000).
    files:
      - services/api/src/wallet/wallet.config.ts
      - services/api/README.md
    rationale: |
      The story fixes 1 -> 1,001. The amount is still unconfirmed by the economy owner, so keep it an env-configurable default rather than a hard-coded literal.
  - description: |
      Wallet panel re-shaped to the prototype (AC1, 2, 3, 7, 8). Extend `ClaimCreditsPanel` (do not add a new component). It stays `({ balanceCredits, topUp })`, and `BalanceTile` stays on the page as the balance stat.
      - `topUp.eligible` true: render the note "Your balance is too low to bet. Claim a free top-up to keep playing." and a `btn btn-primary` "Claim free top-up" (pending label "Claiming…", disabled while pending). The existing `pending` flag stops a double click.
      - `topUp.eligible` false: render the note "You have enough credits to place a bet." and NO claim button, badge or "Not available" copy. The prototype's `wallet-ok` screen has none.
      - Success: toast "Free top-up added: 1,000 credits" (`formatCredits(grantedCredits)`), `role="status"`, then `router.refresh()` so the balance updates in place (1 -> 1,001).
      - Refusal (409): toast with the API message, `role="alert"`, balance unchanged. The failure toast keeps the existing focus behaviour.
      `runClaim` keeps its signature `runClaim({ claimFreeCredits, refresh }): Promise<Outcome>`; only the success message string changes to `Free top-up added: ${formatCredits(result.grantedCredits)}`.
    files:
      - apps/web/src/components/ClaimCreditsPanel.tsx
      - apps/web/src/components/BalanceTile.tsx
      - apps/web/src/app/wallet/page.tsx
    rationale: |
      The prototype shows the claim only when needed ("the claim button exists only when needed"). Today it is always rendered, disabled, which is not "offered" per AC2. The `BalanceTile` and page files change only if the heading or copy needs to move; otherwise leave them untouched.
  - description: |
      Toast reuse. The prototype shows outcomes as `.toast.is-open.is-inline` with an icon: check for success, alert for refusal. Extend the existing `Toast` in `components/appointments/Toast.tsx` with optional props `inline?: boolean`, `tone?: "success" | "error"` (icon check or alert, role status or alert) rather than creating a second toast. Add a `.toast.is-inline { position: static; ... }` rule to `globals.css` using only existing tokens (`--space-3`, `--size-modal`). The prototype's rule is `position: static; transform: none; margin: 0; width: auto; max-width: var(--size-modal)`. First verify that `Icon` in `components/orders/Icon.tsx` has an `alert` glyph, and add one there if not.
    files:
      - apps/web/src/components/appointments/Toast.tsx
      - apps/web/src/components/orders/Icon.tsx
      - apps/web/src/app/globals.css
    rationale: |
      Reuses the shipped Toast. Existing appointments callers must keep the default fixed-position success behaviour unchanged.
  - description: |
      Test and e2e-mock updates for the new 1,000 amount. Update every fixture that hard-codes 500 or 501: the API specs (`wallet.service.spec.ts`, `wallet.controller.spec.ts`, `wallet.config.spec.ts`, `test/wallet.e2e-spec.ts`), the web tests (`ClaimCreditsPanel.test.tsx`, `wallet/page.test.tsx`), and `mock-session-server.mjs` plus `player-accounts.spec.ts` (balance 1001, granted 1000). Also add the new AC tests listed under `tests`.
    files:
      - services/api/src/wallet/wallet.service.spec.ts
      - services/api/src/wallet/wallet.controller.spec.ts
      - services/api/src/wallet/wallet.config.spec.ts
      - services/api/test/wallet.e2e-spec.ts
      - apps/web/src/components/ClaimCreditsPanel.test.tsx
      - apps/web/src/app/wallet/page.test.tsx
      - apps/web/tests/e2e/mock-session-server.mjs
      - apps/web/tests/e2e/player-accounts.spec.ts
    rationale: |
      TDD order: write or adjust these first and watch them fail, then make the config and panel changes.
tests:
  - |
    AC1/AC3 (web, `ClaimCreditsPanel.test.tsx`, fails first because a disabled button is rendered today and the label differs):
    ```ts
    for (const balance of [1, 0]) {
      const html = render(balance, true);
      expect(html).toMatch(/<button(?![^>]*disabled)[^>]*class="btn btn-primary"[^>]*>Claim free top-up<\/button>/);
      expect(html).toContain("Your balance is too low to bet.");
    }
    ```
  - |
    AC2 (web, same file): at a balance of 2 no claim control is rendered at all.
    ```ts
    const html = render(2, false);
    expect(html).not.toContain("Claim free top-up");
    expect(html).not.toContain("<button");
    expect(html).toContain("You have enough credits to place a bet.");
    ```
  - |
    AC1/2 end to end at the API (`wallet.controller.spec.ts`; balances 1, 0 and 2 on `GET /wallet`):
    ```ts
    expect((await controller.balance(req)).topUp.eligible).toBe(true);  // balance 1, then 0
    expect((await controller.balance(req)).topUp.eligible).toBe(false); // balance 2
    ```
  - |
    AC4/AC5 (API e2e, `test/wallet.e2e-spec.ts`, seeded balance 2): the claim is refused and the balance is unchanged.
    ```ts
    await agent.post('/wallet/top-up').expect(409);
    expect((await agent.get('/wallet').expect(200)).body.balanceCredits).toBe(2);
    ```
    Also in `wallet.service.spec.ts`: `expect(await service.claimTopUp('p1')).toEqual({ ok: false, reason: 'balance_not_low' })` and no ledger insert is issued.
  - |
    AC6 (fails first because the default is 500). In `wallet.config.spec.ts`: `expect(topUpCredits({}, warn)).toBe(1000)`. In `wallet.service.spec.ts`: `expect(await service.claimTopUp('p1')).toEqual({ ok: true, balanceCredits: 1001 })` with ledger params `['p1', 'topup', 1000, 1001]`. In the e2e spec, from a balance of 1: `expect(res.body).toEqual({ balanceCredits: 1001, grantedCredits: 1000 })`. In the web panel test:
    ```ts
    expect(await runClaim({ claimFreeCredits, refresh })).toEqual({ ok: true, message: "Free top-up added: 1,000 credits" });
    expect(refresh).toHaveBeenCalledTimes(1);
    ```
  - |
    AC7 (API e2e): claim repeatedly with no cooldown or cap. Loop 3 times: set the wallet balance to 1 directly in the test DB, `POST /wallet/top-up` expects 200, then `GET /wallet` shows `topUp.eligible` true again after the balance is set back to 1. Assert `claimTopUp` has no date or count predicate: the SQL in `wallet.service.spec.ts` still contains `balance_credits <= 1` and no other condition.
  - |
    AC8 (web page test, `wallet/page.test.tsx`): a wallet with `{ balanceCredits: 1, topUp: { eligible: true, credits: 1000 } }` renders `1 credit<` and the "Claim free top-up" button, mirroring a player who has just bet back down to 1.
  - |
    AC9 (API e2e, real database): two simultaneous claims at balance 1, where exactly one wins.
    ```ts
    const [a, b] = await Promise.all([agent.post('/wallet/top-up'), agent.post('/wallet/top-up')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await service.balanceFor(id)).toBe(1001);
    ```
    Also assert exactly one `topup` row in `wallet_entries` for that player.
  - |
    Toast and regression (web): `Toast` with no new props renders unchanged (`toast is-open`, `role="status"`). With `tone="error"` and `inline` it renders `role="alert"`, the alert icon and the `is-inline` class. The Playwright journey in `player-accounts.spec.ts` claims at balance 1 and expects the status toast "Free top-up added: 1,000 credits".
assumptions_or_open_questions:
  - |
    The top-up amount of 1,000 is taken from AC6 (1 -> 1,001). The story and the prototype both say the game economy owner has not yet confirmed it. It stays configurable through `WALLET_TOP_UP_CREDITS`. Please get it confirmed before release.
  - |
    Prototype vs. API on the duplicate claim (AC9). The prototype shows two different toasts: "Free top-up refused: balance is more than 1 credit" (claim at 2) and "Free top-up already claimed" (second simultaneous claim). The API returns the same 409 and `TOP_UP_NOT_LOW_MESSAGE` for both, because after the first claim the balance is already above 1. The plan shows the API message for every refusal and does not add a second refusal reason, since the ACs only require that the second claim is refused. Say so if you want the distinct "already claimed" copy. That would need a new API refusal code.
  - |
    "Balance too low" means a balance of 1 or less, matching the epic decision that the balance must be greater than the bet and the minimum bet of 1. This is already enforced by `canBet` and by the SQL predicate, so no rule change is planned.
  - |
    The prototype's "Prototype controls" boxes (balance switches, "Claim twice at once") are review scaffolding and are not built.
  - |
    The 30-day retention decisions (wallet and history records) apply to the existing ledger and history and are not touched by this item. Top-ups already write `topup` ledger rows.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  None for stored data. There is no schema change or migration: `wallet_entries` already allows kind `topup`, and top-up rows are written by the existing code. Existing wallets and ledger rows are untouched. The one runtime setting is `WALLET_TOP_UP_CREDITS`. It is optional, its default changes from 500 to 1000, and it is documented in `services/api/README.md`. If a deployment already sets it, that value still wins. Rollback: revert the default, since nothing is persisted that depends on it. Deploy order: API and web can ship together. A web build that is ahead of the API only displays `topUp.credits` from the API, so there is no coupling.

  ### Design

  The approved prototype (`PROD-28OCT-STORY-055-design.html`) shows four Wallet screens under the existing top bar, in a single centred `.narrow stack stack-4` column.
  - **Too low (balance 1 or 0):** an `h1` "Wallet", then a `.card.stack` with a "Balance" stat, the note "Your balance is too low to bet. Claim a free top-up to keep playing." and one `.btn.btn-primary` "Claim free top-up". Below it is a "View play history" link.
  - **Enough (balance 2):** the same card with no claim button and the note "You have enough credits to place a bet."
  - **Claimed:** 1,001 credits and an inline success toast with a check icon, "Free top-up added: 1,000 credits".
  - **Refused:** an inline `role="alert"` toast with an alert icon, "Free top-up refused: balance is more than 1 credit".

  Tokens are already loaded: `apps/web/src/app/globals.css:2` imports `../../../../design-system/tokens.css`, and `globals.css:144-146` already holds `.narrow`, `.balance-tile` and `.balance-figure`. Tokens used by the new CSS: `--space-3`, `--size-modal`, `--space-2`, `--color-fg`, `--color-bg`, `--radius-md`. No colour literals.

  Deviations to be aware of. The existing page puts a `BalanceTile` card above the claim panel, while the prototype has one card holding balance and note. The plan keeps `BalanceTile` (the prototype itself names it as the reused stat tile) and does not merge the two cards. The prototype's "View play history" link is outside this item's ACs, so it is only touched if it is not already on the page.

  ```mermaid
  flowchart TD
    Page[wallet/page.tsx] --> Tile[BalanceTile]
    Page --> Panel[ClaimCreditsPanel]
    Panel --> Toast[appointments/Toast]
    Panel --> Session[lib/session.ts claimFreeCredits]
    Session --> Ctl[wallet.controller.ts]
    Ctl --> Svc[wallet.service.ts claimTopUp]
    Svc --> Cfg[wallet.config.ts]
    classDef touched fill:#f96,color:#000
    class Panel,Toast,Cfg touched
  ```
  `ClaimCreditsPanel` is touched to hide the claim when it is not needed and to show toast outcomes. `Toast` is touched for an inline error variant. `wallet.config.ts` is touched for the 1,000 default. The controller, service and session helpers are read-only context. They already enforce the rule and need only test additions.
review_focus: |
  IN scope: the 500 -> 1,000 default, the panel re-shaped to hide the claim above a balance of 1 plus toast outcomes, and new tests for AC4-9. OUT of scope: any new cooldown, cap or refusal code, a merged balance card, the prototype's demo controls, and any change to the SQL rule or the ledger schema. The riskiest part is the panel and Toast change, which must not alter the existing appointments Toast behaviour. The concurrent-claim test (AC9) must run against the real database to prove the single conditional UPDATE serialises. The unconfirmed top-up amount is deliberate: it is a configurable default.
