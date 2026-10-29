summary: |
  Registration, sign-in, the 1,000-credit starting balance and the free top-up (500 credits when the balance is 1 or less, no claim limit) are already built and tested (PlayersService, SessionController, WalletService.claimTopUp, RegisterForm, SignInForm, BalanceTile, ClaimCreditsPanel). Reading the code against the 13 acceptance criteria leaves two real gaps. AC9 requires a duplicate email to show a field error on the email field, but RegisterForm shows it as a form-level alert. AC13 requires the refused top-up message to say the top-up is only available when the balance is 1 or less, but the API and tests use "Your balance is more than 1 credit, so a free top-up is not available." The rest of the plan pins the already-built behaviour (AC1-8, 10-12) with tests that name the AC, adding only what is missing.
scope:
  - description: |
      AC9: a duplicate email (API 409) becomes a field error on the email field. In handleRegister change
      `return { alert: result.status === CONFLICT ? DUPLICATE_EMAIL_ERROR : result.message };` to
      `if (result.status === CONFLICT) return { email: DUPLICATE_EMAIL_ERROR }; return { alert: result.message };`.
      The existing effect already focuses the email input and the existing markup already renders `field-error` with aria-describedby. Reuse RegisterForm; no new component and no new styling, so no design tokens are involved.
    files:
      - apps/web/src/components/RegisterForm.tsx
      - apps/web/src/components/AuthForms.test.tsx
      - apps/web/tests/e2e/player-accounts.spec.ts
    rationale: |
      Smallest change that satisfies AC9 using the form's existing email field-error path.
  - description: |
      AC13: change the refusal text in WalletController.topUp to a message stating the top-up is only available when the balance is 1 credit or less. Proposed: "Free top-up is only available when your balance is 1 credit or less." Hoist it to a constant in wallet.constants.ts so the controller and its specs share it. Update the three places that quote the old string. ClaimCreditsPanel already shows result.message in its alert, so no component change is needed.
    files:
      - services/api/src/wallet/wallet.controller.ts
      - services/api/src/wallet/wallet.constants.ts
      - services/api/src/wallet/wallet.controller.spec.ts
      - apps/web/src/lib/session.test.ts
      - apps/web/src/components/ClaimCreditsPanel.test.tsx
    rationale: |
      The status stays 409 and the rule stays enforced in SQL; only the wording changes.
  - description: |
      Characterisation tests only for AC1-8, 10-12, no production change. Add the AC number to existing test names where it is missing, and add only the assertions that do not exist yet (see tests). Touches services/api/test/session.e2e-spec.ts, services/api/test/wallet.e2e-spec.ts, services/api/src/wallet/wallet.service.spec.ts and apps/web/src/components/AuthForms.test.tsx.
    files:
      - services/api/test/session.e2e-spec.ts
      - services/api/test/wallet.e2e-spec.ts
      - services/api/src/wallet/wallet.service.spec.ts
    rationale: |
      The behaviour exists; the item says it is largely built, so the work is to prove each criterion rather than rebuild it.
tests:
  - |
    AC9 (write first, fails today). In apps/web/src/components/AuthForms.test.tsx change the duplicate-email case to
    `expect(await handleRegister(deps, "a@b.co", "play-2026")).toEqual({ email: DUPLICATE_EMAIL_ERROR });`
    with registerPlayer mocked to return { ok: false, status: 409, message: "..." }. In player-accounts.spec.ts (AC7 test) assert
    `await expect(page.locator("#rg-email-err")).toContainText("An account with this email already exists");`
    and that `page.getByRole("alert")` has count 0.
  - |
    AC13 (write first, fails today). In wallet.controller.spec.ts, when claimTopUp resolves { ok: false, reason: 'balance_not_low' },
    `await expect(controller.topUp(req)).rejects.toThrow(TOP_UP_NOT_LOW_MESSAGE)` and the message matches /only available when your balance is 1 credit or less/.
    Update session.test.ts (409 stub) and ClaimCreditsPanel.test.tsx (runClaim returns `{ ok: false, message }`) to the new text.
  - |
    AC6 (balance 2 refused, stays 2). Extend the wallet.e2e-spec.ts AC10 test: after `await seed(id, 2); await agent.post('/wallet/top-up').expect(409);` add `expect(await service.balanceFor(id)).toBe(2);` and check the response body message equals the new constant.
  - |
    AC4 and AC5 (balance 1 gives 501, balance 0 gives 500). In wallet.e2e-spec.ts loop `for (const [start, end] of [[1, 501], [0, 500]])`, seed `start`, then `expect(await service.claimTopUp(id)).toEqual({ ok: true, balanceCredits: end })`. In wallet.service.spec.ts add an it.each with updated(500) and updated(501) asserting calls[2][1] equals ['p1', 'topup', 500, 500] and ['p1', 'topup', 500, 501].
  - |
    AC7 (repeat claim allowed). In wallet.e2e-spec.ts claim from 1, seed back to 1, claim again:
    `expect(await service.claimTopUp(id)).toEqual({ ok: true, balanceCredits: 501 });` and `expect(await entryCount(id, 'topup')).toBe(2);`.
  - |
    AC1 and AC3 (registration creates the account with 1,000 credits). Confirm in session.e2e-spec.ts that POST /session/register returns 201 and, via GET /wallet, `expect(res.body.balanceCredits).toBe(1000)`. Add the missing assertion only if absent. BalanceTile.test.tsx keeps asserting that 1,000 renders as "1,000 credits".
  - |
    AC2 (sign-in). Confirm session.e2e-spec.ts signs in with the registered credentials and then GET /wallet returns 200 for that agent. Add it if absent.
  - |
    AC8 and AC10 (field errors, no account created). Confirm AuthForms.test.tsx asserts `handleRegister(deps, "not-an-email", "play-2026")` resolves { email: expect.any(String) } and `handleRegister(deps, "a@b.co", "")` resolves { password: expect.any(String) }, each with `expect(deps.registerPlayer).not.toHaveBeenCalled()`. Confirm the API e2e returns 400 for the same inputs with `select count(*) from players` unchanged.
  - |
    AC11 and AC12 (wrong credentials). Confirm session.e2e-spec.ts asserts 401 for an unknown email and a wrong password with the same message. Confirm the Playwright test "AC8: a wrong password shows the message and keeps the email" asserts the alert text and that the URL stays /sign-in, and add `await expect(page).toHaveURL(/\/sign-in$/);` if absent.
assumptions_or_open_questions:
  - |
    Resolved by the reviewer. AC11 is read case-insensitively, so the app text "Email or password incorrect" stays unchanged (SessionController, session.e2e-spec.ts, AuthForms.test.tsx, the Playwright spec).
  - |
    Resolved by the reviewer. The AC13 text is exactly "Free top-up is only available when your balance is 1 credit or less."
  - |
    AC8 and AC10 field errors are produced by client-side validation in RegisterForm (validateEmail, validatePassword in apps/web/src/lib/credentials.ts), and the API also rejects with 400. I did not read credentials.ts, so the tests above are "confirm" steps and the implementer should read it before writing them.
  - |
    Resolved by the reviewer. Wallet history retention, play history retention, audit record retention and concurrent-player capacity are out of scope here. They need separate business or product decisions and are tracked as future requirements.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout
  None — wording and form-error placement only; no schema, stored data, seed or setting changes.

  Existing styling is reused (`field-error`, `alert` classes in RegisterForm); no new UI, so no design tokens are added.

  The top-up rule is already enforced atomically in SQL in WalletService.claimTopUp (`balance_credits <= 1`), with no claim limit, so AC4-7 need no production code. The starting grant of 1,000 is created in PlayersService.register inside the same transaction as the player and wallet rows.
review_focus: |
  IN scope: the duplicate-email field error (RegisterForm.handleRegister) and the top-up refusal wording (WalletController.topUp), plus tests that pin AC1-8 and AC10-12. OUT: jackpot recording, bet validation, any schema or rule change. Riskiest part is moving the 409 to a field error without losing focus or message handling for other register failures. The sign-in message casing is deliberately left as is (reviewer-confirmed, AC11 read case-insensitively), and the AC13 text is reviewer-confirmed.
