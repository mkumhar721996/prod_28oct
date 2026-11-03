summary: |
  Make the wallet refuse a bet larger than the player's balance, with a clear message, and leave the balance and play history untouched when it refuses. The atomic conditional UPDATE in `WalletService.placeBet` already serialises concurrent bets, but it uses a strict `balance_credits > $2` predicate, so a bet of exactly 100 on a balance of 100 is refused. AC3 requires it to be accepted. The fix is to change the predicate to `>=`. There is also no HTTP route to place a bet, so nothing can show the AC2 message. This plan adds a thin `POST /wallet/bet` that maps the refusal to a 409 carrying the message. The bet choice screen stays out, since it belongs to the game epic.
scope:
  - description: |
      Change the bet predicate from strict to inclusive, so a bet equal to the balance is accepted and a bet above it is refused. Before and after:

      ```ts
      // before
      'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits > $2 returning balance_credits'
      // after
      'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits'
      ```

      Update the doc comment on `placeBet` ("accepted when the balance is at least the bet"). Leave `change()` as it is: it already rolls back and writes no ledger row when the UPDATE matches nothing, and the row lock serialises two simultaneous bets.
    files:
      - services/api/src/wallet/wallet.service.ts
    rationale: |
      AC1 and AC3 together need `>=`. The single-statement check-and-debit is what makes AC6 and AC7 hold, so it is kept.
  - description: |
      Add the refusal message and a bet route.

      In `wallet.constants.ts`:

      ```ts
      export const BET_ABOVE_BALANCE_MESSAGE = 'Your bet is larger than your balance.';
      ```

      In `wallet.controller.ts`, add `@Post('bet') @HttpCode(200) async bet(@Req() req: PlayerRequest, @Body() body: { amount?: unknown })`.
      It calls `this.wallet.placeBet(req.player.id, body?.amount)` and maps the result:
      - `insufficient_balance` throws `ConflictException(BET_ABOVE_BALANCE_MESSAGE)`.
      - `invalid_amount` throws `BadRequestException('Enter a whole number of credits to bet.')`.
      - Success returns `{ balanceCredits }`.

      The player id comes from the session only, as in the other routes.
      Leave `canBet`, `MIN_BET` and the top-up rule untouched. Update the `canBet` comment, which currently says the bet needs a balance strictly above the minimum.
    files:
      - services/api/src/wallet/wallet.constants.ts
      - services/api/src/wallet/wallet.controller.ts
    rationale: |
      AC2 needs a message the player can be shown, and the wallet side has no bet entry point yet. The rule stays enforced in SQL, and the controller only translates the result, as `topUp` does.
  - description: |
      Update the existing tests that encoded the strict rule, and add the new ones listed in `tests`. In `wallet.service.spec.ts`, change the predicate-regex test to `/balance_credits >= \$2/`. In `wallet.e2e-spec.ts`, rewrite the "strict balance > bet rule" test: a bet equal to the balance now succeeds, and the balance goes to 0 and not below.
    files:
      - services/api/src/wallet/wallet.service.spec.ts
      - services/api/src/wallet/wallet.controller.spec.ts
      - services/api/test/wallet.e2e-spec.ts
    rationale: |
      The old assertions at wallet.service.spec.ts:56 and wallet.e2e-spec.ts:88-102 contradict AC3 and would fail after the change.
tests:
  - |
    AC3, unit and failing first, in wallet.service.spec.ts. Replace the old predicate test:
    ```ts
    it('checks and changes in one statement with the balance >= bet predicate', async () => {
      const { service, calls } = setup(updated(0));
      await service.placeBet('p1', 100);
      expect(calls[1][0]).toMatch(/balance_credits >= \$2/);
    });
    ```
  - |
    AC3, e2e against real Postgres, in wallet.e2e-spec.ts:
    ```ts
    await seed(id, 100);
    expect(await service.placeBet(id, 100)).toEqual({ ok: true, balanceCredits: 0 });
    ```
  - |
    AC1, e2e:
    ```ts
    await seed(id, 100);
    expect(await service.placeBet(id, 101)).toEqual({ ok: false, reason: 'insufficient_balance' });
    ```
  - |
    AC2, controller spec. Mock `placeBet` to return `{ ok: false, reason: 'insufficient_balance' }`, then:
    ```ts
    await expect(controller.bet(req, { amount: 101 })).rejects.toMatchObject({ status: 409, message: BET_ABOVE_BALANCE_MESSAGE });
    ```
    Also an e2e over HTTP on a balance of 100:
    ```ts
    const res = await agent.post('/wallet/bet').send({ amount: 101 }).expect(409);
    expect(res.body.message).toBe(BET_ABOVE_BALANCE_MESSAGE);
    ```
  - |
    AC4, e2e. After the refused 101 bet on a balance of 100:
    ```ts
    expect(await service.balanceFor(id)).toBe(100);
    expect((await agent.get('/wallet')).body.balanceCredits).toBe(100);
    ```
  - |
    AC5, e2e. After the refused 101 bet:
    ```ts
    expect(await entryCount(id, 'bet')).toBe(0);
    ```
    Also a unit test that the refusal path runs `rollback` and never an `insert into wallet_entries` (the existing test at wallet.service.spec.ts:65 already covers this).
  - |
    AC6 and AC7, e2e. Replace the 6-on-10 test with the spec's numbers:
    ```ts
    await seed(id, 100);
    const results = await Promise.all([service.placeBet(id, 60), service.placeBet(id, 60)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);   // AC6
    expect(await service.balanceFor(id)).toBe(40);          // AC7
    expect(await entryCount(id, 'bet')).toBe(1);
    ```
    Repeat the same check through `POST /wallet/bet` with two parallel `agent.post` calls.
  - |
    Regression. Invalid amounts (0, -1, 1.5, '5') still return `invalid_amount` and make no SQL call. Over HTTP they return 400 and leave the balance unchanged. The top-up tests are unchanged and still pass.
  - |
    Narrow commands, derived from the project test command:
    `(cd services/api && pnpm run test -- wallet.service.spec.ts wallet.controller.spec.ts)`
    and `(cd services/api && pnpm run test:e2e -- wallet.e2e-spec.ts)`.
    The second script name is a guess to confirm in services/api/package.json.
assumptions_or_open_questions:
  - |
    The existing rule was a deliberate strict "balance > bet", which kept a player at 1 credit or more. AC3 overrides it, so a player can now bet down to 0. Please confirm that a balance of 0 is acceptable, because the wallet never goes negative either way.
  - |
    `canBet` and the free top-up (eligible when the balance is 1 or less) are left unchanged. With `>=`, a player at 1 credit can still bet 1 and is also top-up eligible. This is a harmless overlap, but it is a decision for the owner of the top-up story and out of scope here.
  - |
    No bet HTTP route exists today. I assumed AC2 ("a message is shown") is met by the API returning the 409 message, and that the screen that displays it belongs to the game epic, per the item's scope. Please confirm that `POST /wallet/bet` should be added here and not left to the game epic. If the reviewer prefers, drop the controller change and keep only the service change plus the message constant.
  - |
    The exact message wording and the invalid-amount wording are my choice. Please confirm them.
  - |
    The deferred project-wide questions (retention and backup of wallet data, audit record retention, concurrent player count) do not change this work. They stay open for their own items. Nothing in this plan alters stored data or retention.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  None — no schema, stored-data shape, setting or seed changes. Only a SQL predicate and a new route are added. Existing rows are unaffected, and rollback is a plain revert.

  Files read: `services/api/src/wallet/wallet.service.ts`, `wallet.controller.ts`, `wallet.constants.ts`, `wallet.service.spec.ts`, `services/api/test/wallet.e2e-spec.ts`. The web app is untouched: there is no UI step, so the design-system tokens do not apply.

  ```mermaid
  flowchart TD
    C[WalletController POST /wallet/bet - new route]
    K[wallet.constants - message]
    S[WalletService.placeBet - predicate to >=]
    D[(wallets and wallet_entries)]
    G[SessionGuard]
    C --> G
    C --> K
    C --> S
    S --> D
    classDef touched fill:#f96,color:#000
    class C,K,S touched
  ```
review_focus: |
  IN: the `>=` predicate change, the refusal message constant, and a thin `POST /wallet/bet` route. OUT: the bet choice screen, the game epic, and the top-up threshold and `canBet`. The riskiest part is that the strict rule was deliberate in an earlier story, so check that the old strict-rule tests were rewritten and not just loosened. Also check that concurrency (AC6 and AC7) still relies on the single conditional UPDATE and not on any read-then-write.
