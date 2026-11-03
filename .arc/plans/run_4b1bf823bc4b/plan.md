summary: |
  Most of the account plumbing already exists: the Records API has `POST /session/register` and `POST /session/sign-in`
  (scrypt-hashed passwords, 7-day server-side sessions, per-IP/per-email throttling), and the web app has separate `/sign-in`
  and `/register` pages with `SignInForm` and `RegisterForm`. What is missing against the acceptance criteria is the
  approved design's single "Account" page with a Sign in / Create account tab switch (AC6, AC7), the "email already in use"
  alert that carries a "Sign in instead" link (AC4, today a plain field error with no link), one fixed non-specific sign-in
  error that the client owns rather than relays (AC5), and a stricter "standard address format" email check on both web and
  API (AC10, today `a@@b.c` passes). This plan composes the two existing forms into one page, tightens the email rule in one
  place per layer, and pins every AC with a failing test first. No schema change: invited accounts are rows in the same
  `players` table with the same hash format, so they already authenticate through the same endpoint (AC3); the plan proves
  it with a test rather than assuming it.
scope:
  - description: |
      Tighten the email rule on the web side (AC10) and align the copy with the design. In
      `apps/web/src/lib/credentials.ts` change the pattern from `/^\S+@\S+\.\S+$/` to
      `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` (the pattern the prototype's script uses) and change `PASSWORD_ERROR` to
      "Password must be at least 8 characters." and `EMAIL_ERROR` to "Enter an email like name@example.com." (design
      copy, sentence case, ends with a full stop). `MIN_PASSWORD_LENGTH` stays 8, so 7 characters is refused and exactly 8 passes (AC8, AC9).
      Sign-in does NOT run `validateEmail`, so an invitation-based account with an unusual address can still sign in.
    files:
      - apps/web/src/lib/credentials.ts
      - apps/web/src/lib/credentials.test.ts
    rationale: |
      One place owns the web rule, and the design's error copy matches the guidelines' "say what went wrong and how to fix it".
  - description: |
      Tighten the same rule on the API (AC10 must hold even when the client check is bypassed). In
      `services/api/src/players/players.constants.ts` set `EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`.
      `PlayersService.register` already normalises (trim, lowercase), checks the pattern, checks length >= 8 and <= 128, and
      inserts player, wallet and grant in one transaction, so a refused registration creates nothing (AC8, AC10). Messages
      returned by the API are left as they are; the web client decides what to show. Only `register` validates the format, so existing
      rows and `authenticate` are untouched.
    files:
      - services/api/src/players/players.constants.ts
      - services/api/src/players/players.service.spec.ts
      - services/api/test/session.e2e-spec.ts
    rationale: |
      The server is the enforcement point; the web check is only for fast feedback.
  - description: |
      Make the sign-in error one fixed message the client owns (AC5). In `apps/web/src/components/SignInForm.tsx` export
      `SIGN_IN_ERROR = "Email or password is incorrect. Check both and try again."` and change `handleSignIn` so a 401 always
      returns that constant (the API's wording is never shown), while any other failure (network, 429 throttle) keeps its own
      message. Before → after of the helper:

      ```ts
      // before
      if (!result.ok) return result.message;
      // after
      if (!result.ok) return result.status === 401 ? SIGN_IN_ERROR : result.message;
      ```

      Drop the page-level `h1`, the `.narrow` wrapper and the "Create an account" link from `SignInForm`; it becomes the
      card only (`<form className="card stack" ...>`) and takes `email`/`onEmailChange` props so the Account page can share the
      email between modes. Keep the email on failure, clear only the password, and move focus to the alert (existing behaviour, matches the prototype's
      "sign-in-error" screen). Alert markup follows the prototype: `.alert.alert-danger` with the `alert` icon (reuse
      `Icon` from `apps/web/src/components/orders/Icon.tsx` if it has the alert glyph, otherwise render the same `svg`) and a span.
    files:
      - apps/web/src/components/SignInForm.tsx
      - apps/web/src/lib/session.test.ts
    rationale: |
      Fixes the wording in one place so no code path can say which of email or password was wrong.
  - description: |
      Rework `RegisterForm` for the "Email already in use" alert (AC4) and the prototype's field layout. Remove the `h1`,
      `.narrow` wrapper, the "Already have an account?" link and the "New accounts start with 1,000 credits." note (the
      prototype shows none of them). Signature changes:

      ```ts
      export const EMAIL_IN_USE_ERROR = "This email is already in use.";
      export type RegisterErrors = { email?: string; password?: string; inUse?: boolean };
      export function RegisterForm(props: {
        email: string;
        onEmailChange: (email: string) => void;
        onSignInInstead: () => void;
      }): JSX.Element;
      ```

      `handleRegister` returns `{ inUse: true }` on a 409 (replacing `DUPLICATE_EMAIL_ERROR` and the field error) and
      `{ alert: message }` for other failures is kept. The in-use state renders `.alert.alert-danger` (role="alert",
      `tabIndex={-1}`, focused on appear) holding the text and a `.link-btn`-style "Sign in instead" button that calls
      `onSignInInstead` (email kept, password cleared). The email input also gets `.is-invalid`. Format and length errors stay
      as `.field-error` text under the field with `.is-invalid` and `aria-describedby`; the password hint reads "Use at least 8 characters." On success keep `replace` + `refresh` so the customer is signed in
      straight away (AC1, AC9); no verification step.
    files:
      - apps/web/src/components/RegisterForm.tsx
      - apps/web/src/components/AuthForms.test.tsx
    rationale: |
      The decided project behaviour is "clear 'email already in use' message with a link to sign in", which today is missing the link.
  - description: |
      New composition `AccountScreen` (the prototype's "Account page shell"; no new primitives) that renders the `h1` "Account",
      a `.tabs` list with two `.tab` buttons (`role="tab"`, `aria-selected`, labels "Sign in" and "Create account") and
      the active form (`SignInForm` or `RegisterForm`) in a `.card`, inside a `.account stack stack-4` wrapper
      (max width `size-modal`, centred). Props:

      ```ts
      export function AccountScreen(props: {
        initialMode: "sign-in" | "register";
        redirected?: boolean;
        redirectTo?: string;
      }): JSX.Element;
      ```

      It owns `mode` and `email` state; "Sign in instead" sets `mode = "sign-in"` and keeps the email. Tab arrow-key support:
      arrow keys move between the two tabs (roving `tabIndex`), matching the prototype kit. The existing "Sign in to see your wallet." info alert (`redirected`) stays above the form.
      Pages: `apps/web/src/app/sign-in/page.tsx` renders `<AccountScreen initialMode="sign-in" ... />` with the existing `next`
      handling (`signInTarget`); `apps/web/src/app/register/page.tsx` renders `initialMode="register"`, so the existing
      `REGISTER_HREF` keeps working. A signed-in visitor is not covered (out of scope: signing out/in redirects belong to other stories).
    files:
      - apps/web/src/components/AccountScreen.tsx
      - apps/web/src/components/AccountScreen.test.tsx
      - apps/web/src/app/sign-in/page.tsx
      - apps/web/src/app/register/page.tsx
    rationale: |
      AC6 and AC7 need both options on ONE page; tabs switch in place without leaving the page, exactly as the prototype does.
  - description: |
      Styling: tokens are already loaded by `apps/web/src/app/globals.css:2`
      (`@import "../../../../design-system/tokens.css"`), and `.tabs`, `.tab`, `.alert-danger`, `.card`, `.narrow` and
      `a.link` already exist in that file. Add only what the prototype's own `<style>` adds and `globals.css` lacks (verify first):
      `.account .tabs { overflow-x: visible }`, `.account .tab { min-height: var(--size-control); flex: 1 }`,
      `.account .alert { align-items: flex-start }`, `.link-btn` (`font-weight: var(--font-weight-semibold)`,
      `min-height: var(--size-control-sm)`, focus ring `var(--border-width-strong) solid var(--color-focus)` with
      `var(--size-focus-offset)`). Note `globals.css:75` sets `.alert-danger { align-items: center }`; the `.account` rule must win by specificity.
      Tokens used: `--size-modal`, `--space-3`, `--space-4`, `--size-control`, `--size-control-sm`, `--font-weight-semibold`,
      `--color-focus`, `--border-width-strong`, `--size-focus-offset`, `--color-danger`, `--color-danger-bg`, `--color-danger-border`, `--color-primary`. No colour or pixel literals.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      Reuses the shipped tab and alert styles; adds the four small rules the approved design needs.
tests:
  - |
    AC1 (web, vitest, `AuthForms.test.tsx`): a valid registration signs in and moves on, nothing else is asked for.
    ```ts
    const deps = { ...nav(), registerPlayer: vi.fn(async () => ({ ok: true as const })) };
    expect(await handleRegister(deps, "new@example.com", "play-2026")).toEqual({});
    expect(deps.replace).toHaveBeenCalledWith("/wallet?welcome=1");
    expect(deps.refresh).toHaveBeenCalled();
    ```
    API (`session.e2e-spec.ts`, already passing as "AC1: register signs the visitor in") must keep passing: register then `GET /session` with the returned cookie answers 200.
  - |
    AC2 (API e2e, `services/api/test/session.e2e-spec.ts`): a self-registered customer signs out then signs in again.
    ```ts
    await agent.post('/session/register').send({ email: 'ana@example.com', password: 'play-2026' }).expect(201);
    await agent.post('/session/sign-out').expect(204);
    await agent.post('/session/sign-in').send({ email: 'Ana@Example.com ', password: 'play-2026' }).expect(200);
    ```
    Web (`AuthForms.test.tsx`): `expect(await handleSignIn(deps, "a@b.co", "play-2026")).toBeNull()` and `replace` called with the redirect target.
  - |
    AC3 (API, `players.service.spec.ts` and `session.e2e-spec.ts`): an account that was NOT created through `register` (inserted straight into
    `players` with a hash from `PasswordService.hash`, standing in for an invitation-based account, no wallet needed) signs in.
    ```ts
    const hash = await passwords.hash('invited-pass1');
    await pool.query('insert into players (email, password_hash) values ($1, $2)', ['invited@example.com', hash]);
    await agent.post('/session/sign-in').send({ email: 'invited@example.com', password: 'invited-pass1' }).expect(200);
    ```
    Also a unit test that `authenticate('invited@example.com', 'invited-pass1')` resolves to `{ id, email }`.
  - |
    AC4 (web, `AuthForms.test.tsx`): a 409 is shown as "in use" with the sign-in way out, and `RegisterForm` renders the link.
    ```ts
    const deps = { ...nav(), registerPlayer: vi.fn(async () => ({ ok: false as const, status: 409, message: "x" })) };
    expect(await handleRegister(deps, "taken@example.com", "play-2026")).toEqual({ inUse: true });
    expect(deps.replace).not.toHaveBeenCalled();
    ```
    `AccountScreen.test.tsx`: after the in-use result the markup contains `This email is already in use.` and a button named `Sign in instead`; clicking it switches `mode` to sign-in with the email still filled (use `@testing-library/react` only if the project already depends on it, otherwise test the extracted mode reducer / pure helpers with `renderToStaticMarkup`).
    Playwright (`apps/web/tests/e2e/player-accounts.spec.ts`, replace the old "AC7: a duplicate email shows the alert" test): stub `**/session/register` with 409, submit, then
    `await expect(page.getByRole("alert")).toContainText("This email is already in use.")` and `await page.getByRole("button", { name: "Sign in instead" }).click()` shows the Sign in tab with the email kept.
    API e2e already covers 409 for any case or spacing.
  - |
    AC5 (web, `AuthForms.test.tsx` and `session.test.ts`): the shown message is the fixed constant whatever the API says, for wrong email and wrong password alike.
    ```ts
    const wrong = (message: string) => ({ ...nav(), signInPlayer: vi.fn(async () => ({ ok: false as const, status: 401, message })) });
    expect(await handleSignIn(wrong("No such email"), "a@b.co", "x")).toBe(SIGN_IN_ERROR);
    expect(await handleSignIn(wrong("Wrong password"), "a@b.co", "x")).toBe(SIGN_IN_ERROR);
    expect(SIGN_IN_ERROR).not.toMatch(/\b(email|password) (is )?(wrong|unknown|not found)/i);
    ```
    A non-401 failure still returns its own message: `status: 429` returns `"Too many attempts"`. The API e2e "AC8: a wrong password and an unknown email get the same answer" already pins identical 401 bodies. Playwright: update "AC8" to expect `getByRole("alert")` to have the new fixed text with the email kept and the password empty.
  - |
    AC6 (web, `AccountScreen.test.tsx`): the sign-in page offers account creation.
    ```ts
    const html = renderToStaticMarkup(<AccountScreen initialMode="sign-in" />);
    expect(html).toContain('role="tab"');
    expect(html).toContain("Create account");
    ```
    Playwright: `await page.goto("/sign-in"); await expect(page.getByRole("tab", { name: "Create account" })).toBeVisible();` and clicking it shows a `Create account` button in the form.
  - |
    AC7 (web, `AccountScreen.test.tsx`): the same page offers sign-in, selected by default, with the sign-in form.
    ```ts
    const html = renderToStaticMarkup(<AccountScreen initialMode="sign-in" />);
    expect(html).toMatch(/aria-selected="true"[^>]*>Sign in</);
    expect(html).toContain('autoComplete="current-password"');
    ```
    `renderToStaticMarkup(<AccountScreen initialMode="register" />)` selects the "Create account" tab and contains `autoComplete="new-password"`.
  - |
    AC8 (web `credentials.test.ts`, `AuthForms.test.tsx`; API `players.service.spec.ts`, `session.e2e-spec.ts`): 7 characters refused, no account created.
    ```ts
    expect(validatePassword("abc1234")).toBe("Password must be at least 8 characters.");
    expect(await handleRegister(deps, "a@b.co", "abc1234")).toEqual({ password: PASSWORD_ERROR });
    expect(deps.registerPlayer).not.toHaveBeenCalled();
    ```
    API: `await agent.post('/session/register').send({ email: 'a@b.co', password: 'abc1234' }).expect(400);` then a sign-in with those credentials answers 401 and `select count(*) from players where email = 'a@b.co'` is 0.
  - |
    AC9 (web and API): exactly 8 characters with a valid email creates the account.
    ```ts
    expect(validatePassword("abcd1234")).toBeNull();
    await agent.post('/session/register').send({ email: 'b@c.de', password: 'abcd1234' }).expect(201);
    ```
    Plus the `handleRegister` success case from AC1 with an 8-character password; the 128/129 boundary tests that exist stay as they are.
  - |
    AC10 (web `credentials.test.ts`; API `players.service.spec.ts`, `session.e2e-spec.ts`): non-standard addresses are refused, nothing is created.
    ```ts
    for (const bad of ["nope", "a@b", "a@@b.co", "a b@c.de", "a@b.c", "@b.co"]) expect(validateEmail(bad)).toBe(EMAIL_ERROR);
    expect(validateEmail(" name@example.com ")).toBeNull();
    ```
    API: each bad address in `POST /session/register` with a valid password answers 400 and leaves `players` unchanged (check the row count before and after). Note `a@b.c` is refused by the 2-letter top-level rule in the prototype's pattern.
  - |
    Regression (existing tests that must be edited, not deleted): `AuthForms.test.tsx` "form markup" tests (move to `AccountScreen.test.tsx`, drop the 1,000-credits and "Sign in to see your wallet" markup assumptions that no longer apply to the card), `credentials.test.ts` (new copy), `session.test.ts` (the 401 wording now comes from the constant), `player-accounts.spec.ts` AC7/AC8.
    Narrow commands: `cd apps/web && pnpm test -- src/components/AuthForms.test.tsx src/components/AccountScreen.test.tsx src/lib/credentials.test.ts src/lib/session.test.ts`, `cd services/api && pnpm run test -- players.service.spec`, and the API e2e run for `session.e2e-spec.ts` with the project's existing e2e script.
assumptions_or_open_questions:
  - |
    DECIDED (reviewer approved): "invitation-based" accounts. The repository has no invitation feature, table or endpoint (grep for invit and customer in source, excluding plans and lockfiles), only `players` rows with a scrypt `salt:key` hash. Invited customers are represented as existing `players` records using the same password hash format as standard accounts, so the existing sign-in endpoint serves them (AC3). No invitation entity, workflow or table is part of this story; a dedicated invitation system can come later if business needs change.
  - |
    Deferred question "How long do sessions last and how are they revoked?": answered from the code. `SESSION_DAYS = 7` in `services/api/src/session/session.service.ts`, the cookie is HttpOnly, SameSite=lax, Secure in production, only the SHA-256 of the token is stored, and sign-out deletes the row. No change here. DECIDED (reviewer approved): session management and password storage follow the existing implementation. Expired-session cleanup and forced session revocation after password changes are explicitly OUT of scope; they are future security-hardening items.
  - |
    Deferred question "How are passwords stored?": answered from the code. scrypt with a 16-byte random salt, 64-byte key, constant-time compare, an unknown email costs the same as a wrong password (dummy hash), and sign-in is throttled per IP and per email (10 failures) with registration at 20 per IP. No change planned.
  - |
    Still unresolved at project level, acknowledged by the reviewer as NOT blocking this story (from the epic and CHORE-042): retention of account and sign-in records, monitoring of sign-in failures, and backup/recovery of customer accounts. Nothing in this plan implements them. The reviewer's recommendations for later are sign-in audit logs kept 1-2 years, account and transaction records kept per business or compliance requirements, failed sign-in monitoring through application logging and alerting, and backup and recovery as a project-wide operational decision. The throttle already refuses repeated failures but nothing logs or alerts on them.
  - |
    DECIDED (reviewer approved): after sign-in keep the existing behaviour, redirect to the `next` page when present, otherwise to `/wallet` (`/wallet?welcome=1` after registration). The prototype's "Signed in / Welcome" screen is illustrative only and is NOT built.
  - |
    Existing product wording uses "player", "wallet" and "credits" (an earlier domain), while this story says "customer". I kept the API's `role: 'player'`, `players` table and `/session/*` routes unchanged to stay within the ACs; only UI copy visible on the Account page uses the design's neutral wording. DECIDED (reviewer approved): the "New accounts start with 1,000 credits." line is removed from the register card and must not appear in the final UI, since the prototype has no such copy; any future signup bonus should be driven by business rules, not hard-coded text. The grant itself in `PlayersService.register` is untouched, and the `AuthForms.test.tsx` assertion on that line is removed.
  - |
    Email normalisation: both the API and the e2e treat addresses case-insensitively (trimmed and lowercased on register and sign-in). I assume that is wanted for "email already in use" too, as the existing e2e AC7 test already asserts.
  - |
    Prototype detail not copied: the `create-account` screen in the HTML has a malformed `<label for="ca-password">` with no closing tag and the error text above the label. I build a normal label above the input with the `.field-error` text below it, which is what the UI guidelines ask for ("`.is-invalid` plus `.field-error` text").
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  None — no schema, migration, seed or setting changes. The tightened `EMAIL_PATTERN` is applied only when a NEW account is registered (`PlayersService.register`); `authenticate` and the web sign-in path never test the format, so every existing row (self-registered or invitation-based) signs in exactly as before. Rolling back is a plain revert of the web and API commits; either side can ship first because the web client check is stricter or equal to the API check and the API messages are unchanged.

  ### Research findings

  - Tokens: `apps/web/src/app/globals.css:2` imports `design-system/tokens.css`; `.tabs`, `.tab`, `.alert-danger`, `.narrow`, `a.link` are already defined there (lines 28, 42-50, 115, 144). `globals.css:75` sets `.alert-danger { align-items: center }`, which the prototype overrides inside `.account`.
  - Prototype read in full: `.account` column (max width `var(--size-modal)`), `h1` "Account", a two-tab `role="tablist"` labelled "Account mode", one `.card.stack` form per mode, `.alert.alert-danger` with the alert icon, "Email" and "Password" `.field`s with placeholder `name@example.com`, one `.btn.btn-primary` per view, and `.spinner` in the pending button. Rules in its script: email trimmed and lowercased, email regex `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`, password under 8 refused, in-use shows an alert with "Sign in instead" that keeps the email, wrong sign-in keeps the email, clears the password and focuses the alert.
  - Prototype versus ACs: no conflict. The only gap is the "Signed in" screen (see assumptions). The prototype's pending state shows a spinner and "Signing in…" / "Creating account…"; the existing forms already use those labels, so keep them and add the `.spinner` span.
  - Reused catalogue components: `SignInForm`, `RegisterForm` (reworked to card-only), `Icon` (orders) for the alert glyph if it has one. New: `AccountScreen` only, which the prototype itself marks as the one new composition.
  - Voice: sentence case, verb-first buttons, errors that say how to fix.

  ```mermaid
  flowchart TD
    SP[app/sign-in/page.tsx]:::touched -->|initialMode sign-in| AS[AccountScreen]:::touched
    RP[app/register/page.tsx]:::touched -->|initialMode register| AS
    AS -->|tab: Sign in| SF[SignInForm]:::touched
    AS -->|tab: Create account| RF[RegisterForm]:::touched
    SF --> SES[lib/session.ts signInPlayer]
    RF --> SES
    RF --> CR[lib/credentials.ts]:::touched
    SES -->|POST /session/sign-in, /session/register| SC[session.controller.ts]
    SC --> PS[players.service.ts]
    PS --> PC[players.constants.ts EMAIL_PATTERN]:::touched
    PS --> PW[password.service.ts]
    SC --> SS[session.service.ts]
    GC[globals.css]:::touched -.styles.-> AS
    classDef touched fill:#f96,color:#000
  ```

  Touched: the two pages (now both render `AccountScreen`), `AccountScreen` (new, owns mode and shared email), both forms (AC4/AC5 behaviour and card-only layout), `credentials.ts` and `players.constants.ts` (AC10 rule on each layer), `globals.css` (four small design rules).

  ### Order of work (TDD)

  1. Write all failing tests listed above (web vitest, API jest and e2e, Playwright updates).
  2. Email rule on both layers (AC8-AC10), then `SIGN_IN_ERROR` (AC5), then `RegisterForm` in-use alert (AC4), then `AccountScreen` and the pages (AC6, AC7), then CSS.
  3. Run the narrow commands, then the full project command once at the end.
review_focus: |
  IN scope: one Account page with Sign in / Create account tabs, the "email already in use" alert with a "Sign in instead" link, a fixed client-owned sign-in error, and a stricter email format rule on web and API. OUT (reviewer-confirmed): password recovery, email verification, sign-out and checkout prompts, order-history gating, retention and monitoring, expired-session cleanup, session revocation on password change, any schema change, and any invitation entity or workflow (invited customers are plain `players` rows). The riskiest part is the tightened `EMAIL_PATTERN` and the reworked form props; check that sign-in never validates email format so existing and invited accounts cannot be locked out. Deliberate: the API's `players`/`role: 'player'` naming and its error messages stay unchanged, and post-success navigation keeps using `next`/`/wallet` rather than the prototype's fixture "Welcome" card.
