summary: |
  Make the wallet refuse a bet only when it is larger than the balance. Today `WalletService.placeBet` uses `balance_credits > $2` (strictly greater), so a 100 bet on a balance of 100 is wrongly refused, which contradicts AC3. The plan changes the atomic conditional UPDATE to `>=`, adds a clear "bet is larger than your balance" message, and exposes it through a session-guarded `POST /wallet/bet` route that answers 409 with that message. A refused bet changes no balance and writes no ledger row (already guaranteed by the rollback in `change`). Concurrency (two 60s on 100 leaves 40) is already serialised by the UPDATE row lock and is pinned with tests. The bet choice screen stays out (game epic).
scope:
  - description: |
      Change the bet rule from "balance strictly greater than bet" to "balance at least the bet", and add the refusal message constant.
      Before: `'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits > $2 returning balance_credits'`
      After:  `'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits'`
      Add to wallet.constants.ts (built from MIN_BET like TOP_UP_NOT_LOW_MESSAGE, so the numbers cannot drift):
      `export const BET_ABOVE_BALANCE_MESSAGE = `Your bet is larger than your balance. You can bet up to your full balance. A free top-up is available when your balance is ${MIN_BET} credit or less.`;`
      Leave `canBet` logic and the top-up threshold (`balance_credits <= 1`) untouched (reviewer confirmed); only reword the `canBet` comment, which still says a balance must exceed the minimum bet to bet.
    files:
      - services/api/src/wallet/wallet.service.ts
      - services/api/src/wallet/wallet.constants.ts
    rationale: |
      The single conditional UPDATE is both the check and the debit, so the row lock keeps concurrent bets from overdrawing. Only the comparison changes.
  - description: |
      Add `POST /wallet/bet` with body `{ amount }`, session-guarded like the other wallet routes (player id from the session only).
      ```ts
      @Post('bet')
      @HttpCode(200)
      async bet(@Req() req: PlayerRequest, @Body() body: { amount?: unknown }) {
        const result = await this.wallet.placeBet(req.player.id, body?.amount);
        if (!result.ok) {
          throw result.reason === 'invalid_amount'
            ? new BadRequestException(INVALID_BET_MESSAGE)
            : new ConflictException(BET_ABOVE_BALANCE_MESSAGE);
        }
        return { balanceCredits: result.balanceCredits };
      }
      ```
      Add `INVALID_BET_MESSAGE = 'Enter a whole number of credits, at least 1.'` to wallet.constants.ts.
    files:
      - services/api/src/wallet/wallet.controller.ts
      - services/api/src/wallet/wallet.constants.ts
    rationale: |
      AC2 needs a message the player sees; the service only returns a reason code, and no bet route exists yet. The route mirrors `top-up` (409 with a message). The future game screen calls it.
  - description: |
      Update existing tests that encoded the old strict rule, and add the new ones (see tests).
    files:
      - services/api/src/wallet/wallet.service.spec.ts
      - services/api/src/wallet/wallet.controller.spec.ts
      - services/api/test/wallet.e2e-spec.ts
    rationale: |
      The old specs expect a bet equal to the balance minus 1 to leave 1, and a bet of 1 on balance 1 to be refused; those expectations change.
tests:
  - |
    AC1 (service unit, wallet.service.spec.ts): write first, fails until the SQL still refuses 101 on 100.
    ```ts
    // mocked update returns no row when balance 100 < 101
    expect(await service.placeBet('p1', 101)).toEqual({ ok: false, reason: 'insufficient_balance' });
    ```
    E2E (real Postgres, wallet.e2e-spec.ts): seed wallet 100, same assertion.
  - |
    AC2 (controller unit and supertest e2e): refused bet maps to 409 with the message.
    ```ts
    await expect(controller.bet(req, { amount: 101 })).rejects.toThrow(BET_ABOVE_BALANCE_MESSAGE);
    // e2e
    const res = await request(app.getHttpServer()).post('/wallet/bet').set(auth).send({ amount: 101 });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(BET_ABOVE_BALANCE_MESSAGE);
    ```
  - |
    AC3 (e2e, fails on current `>`): a bet equal to the balance is accepted.
    ```ts
    // balance 100
    expect(await service.placeBet(id, 100)).toEqual({ ok: true, balanceCredits: 0 });
    ```
    Also assert the SQL text contains `balance_credits >= $2` in the unit spec, and rewrite the existing expectations (bet 1 on balance 1 is now accepted; bet 10 on 10 is accepted).
  - |
    AC4 (e2e): after the refused 101 the balance is unchanged.
    ```ts
    await service.placeBet(id, 101);
    expect(await service.balanceFor(id)).toBe(100);
    // and via HTTP
    expect((await request(app.getHttpServer()).get('/wallet').set(auth)).body.balanceCredits).toBe(100);
    ```
  - |
    AC5 (e2e): no new bet ledger row after a refusal.
    ```ts
    const before = (await service.historyFor(id, { page: 1, range: 'all' })).total;
    await service.placeBet(id, 101);
    const after = await service.historyFor(id, { page: 1, range: 'all' });
    expect(after.total).toBe(before);
    expect(after.entries.some((e) => e.kind === 'bet')).toBe(false);
    ```
    Unit: assert `rollback` was issued and no `insert into wallet_entries` call on refusal.
  - |
    AC6 (e2e, real Postgres): two simultaneous 60s on 100.
    ```ts
    const results = await Promise.all([service.placeBet(id, 60), service.placeBet(id, 60)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: 'insufficient_balance' }]);
    ```
  - |
    AC7 (e2e): same race, then the balance and ledger agree.
    ```ts
    expect(await service.balanceFor(id)).toBe(40);
    expect((await service.historyFor(id, { page: 1, range: 'all' })).entries.filter((e) => e.kind === 'bet')).toHaveLength(1);
    ```
  - |
    Validation guard (controller): non-integer or missing amount returns 400.
    ```ts
    await expect(controller.bet(req, { amount: 1.5 })).rejects.toThrow(INVALID_BET_MESSAGE);
    ```
assumptions_or_open_questions:
  - |
    Confirmed by the reviewer: the strict-greater rule is overridden, so a balance of 1 credit is enough for a 1-credit bet (placeBet uses `>=`).
  - |
    Confirmed by the reviewer: a player with balance 1 can bet and stays top-up eligible (balance 1 or less); the top-up threshold and `canBet` stay unchanged. The `canBet` name and its comment now no longer mean "can place a bet", so only its comment is reworded to say it marks top-up eligibility. This is the one touch to that line.
  - |
    Confirmed by the reviewer: the message wording is acceptable, with the request that it explain both betting eligibility and top-up eligibility. The constant now states that a bet up to the full balance is allowed and when the free top-up is available. "A message is shown" is delivered as the 409 response message from `POST /wallet/bet`; rendering it belongs to the game epic's bet screen.
  - |
    Retention and backup for wallet transactions and play history, audit retention, and concurrent-player targets (deferred project-wide questions) do not affect this change and are not answered here.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout
  None — no schema, stored-data, seed or setting change; only a comparison operator, two message constants and one new route. Safe to roll back by reverting the code.

  The race is already handled by the conditional UPDATE in `WalletService.change`: the second transaction waits on the row lock, re-evaluates `balance_credits >= 60` against 40 and updates zero rows. Do not add a read-then-write check in the service, because that would reintroduce the race. The `wallet_entries.balance_after_credits >= 0` check constraint remains as a backstop.

  No web change is planned: the bet choice screen is the game epic's. The existing UI components (BalanceTile and others) are untouched, so no design-token work applies.

  ```mermaid
  flowchart TD
    C[wallet.controller.ts: new POST bet route]:::touched --> S[wallet.service.ts: placeBet uses >=]:::touched
    C --> K[wallet.constants.ts: messages]:::touched
    S --> D[DatabaseService pool]
    G[SessionGuard] --> C
    S --> W[(wallets and wallet_entries)]
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN scope: the `>` to `>=` change in placeBet, the refusal message (covering both bet and top-up eligibility), and a `POST /wallet/bet` route, plus tests. OUT: bet screen, top-up threshold, `canBet` logic (comment only), any schema change. Riskiest part is concurrency, so keep the check inside the single UPDATE and let the e2e race test on real Postgres prove it. The old strict-greater rule is deliberately overturned because AC3 demands it.
