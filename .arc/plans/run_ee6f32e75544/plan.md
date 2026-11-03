summary: |
  Add a required display name to the existing email and password registration. The API stores it in a new nullable `players.name` column, validates it (required, trimmed, at most 50 characters, not unique) and returns 400 field errors. The Create account form (`RegisterForm`) gets a Name field with inline errors beside the name, email and password fields. A successful sign-up now lands on the lobby (`/lobby`) instead of `/wallet?welcome=1`, signed in with the 1,000-credit grant already written by `PlayersService.register`. Duplicate emails stay a 409 caused by the unique index on `players.email`. That index is also the answer to the deferred concurrency question: two simultaneous sign-ups for one email cannot both commit.
scope:
  - description: |
      Migration `005_player_name.sql`: `alter table players add column if not exists name text;` plus a check constraint added idempotently, `name is null or char_length(name) between 1 and 50`. The column is nullable so existing rows stay valid.
      Add `MAX_NAME_LENGTH = 50` to `players.constants.ts`.
    files:
      - services/api/migrations/005_player_name.sql
      - services/api/src/players/players.constants.ts
    rationale: |
      Players have no name column today (001 creates only email and password_hash). Follows the idempotent style of migrations 001-004. The check constraint pins the 50-character limit, like 003 and 004 do for their constants.
  - description: |
      `PlayersService.register(email, password)` becomes `register(name: unknown, email: unknown, password: unknown)`.
      Validation runs in this order: name, email, password. Name is trimmed and must be 1..50 characters, otherwise `BadRequestException({ field: 'name', message })`. Email and password errors use the same `{ field, message }` body shape.
      The insert becomes `insert into players (name, email, password_hash) values ($1,$2,$3)`.
      The unique-violation handler is unchanged, but its ConflictException gets `field: 'email'`.
      Names are NOT unique: no index and no lookup (AC7).
      `Player` gains an optional `name`.
      `SessionController.register` passes `body.name`. The `Credentials` type gains `name?: unknown`.
    files:
      - services/api/src/players/players.service.ts
      - services/api/src/session/session.controller.ts
      - services/api/src/players/players.service.spec.ts
      - services/api/src/session/session.controller.spec.ts
    rationale: |
      Server-side validation is the source of truth, and the form's client checks are only a convenience. The duplicate check relies on the unique index, not on a select-then-insert, so it holds under concurrent sign-ups. The race is covered by a test.
  - description: |
      Web lib: add `validateName(name: string): string | null` and `MAX_NAME_LENGTH = 50` to `credentials.ts`. The error text is "Enter your name" when empty and "Use 50 characters or fewer" when too long.
      `registerPlayer(email, password)` becomes `registerPlayer(name, email, password)`, and `postCredentials` includes `name` in the body only for registration.
      `AuthResult` failures keep `status`, and a 400 body's `field` is passed through so server errors can be shown beside the right field.
    files:
      - apps/web/src/lib/credentials.ts
      - apps/web/src/lib/credentials.test.ts
      - apps/web/src/lib/session.ts
      - apps/web/src/lib/session.test.ts
    rationale: Reuses the existing validators and the single `postCredentials` fetch helper instead of adding a second path.
  - description: |
      Extend `RegisterForm` (do not create a new component).
      Sketch: screen `register` (Create account), a card containing the heading "Create an account", the inputs Name, Email and Password, the primary button "Create account", and the link "Already have an account? Sign in".
      States: default, per-field error (name, email incl. duplicate, password), pending ("Creating account…") and a general alert for network or server errors.
      `handleRegister(deps, name, email, password)` validates in the order name, email, password. Today it returns only the first error, and it will now return all failing field errors at once so each field shows its inline error on one submit. The result is `{ name?, email?, password?, alert? }`.
      On success it calls `deps.replace(LOBBY_HREF)` and then `refresh` (flow `register-done` -> lobby). On any failure it stays on the screen and does not navigate (AC6).
      Markup uses `.card`, `.stack`, `.field`, `.input`, `.is-invalid`, `.field-error`, `.field-hint`, `.btn .btn-primary` and `.alert .alert-danger`, plus `.link` for Sign in. Tokens come only through those existing classes, and no new CSS or literals are added. `design-system/tokens.css` is already imported at `apps/web/src/app/globals.css:2`.
      Name input: `id="rg-name"`, `autoComplete="name"`, `maxLength` NOT set, so the 51-character case reaches validation. Focus goes to the first invalid field.
      Keep the existing "New accounts start with 1,000 credits." note.
    files:
      - apps/web/src/components/RegisterForm.tsx
      - apps/web/src/components/AuthForms.test.tsx
    rationale: |
      The sketch is one card form, and RegisterForm already implements most of it. Showing all field errors together is needed for AC2-AC5 and AC12 to be visible beside the right field.
  - description: |
      Check that the lobby shows the signed-in new player with a balance of 1,000. The lobby is `LobbyScreen` under `TopBar`/`BalanceTile`, and the route is `/lobby`. Only change the lobby if the e2e test fails. The lobby is currently listed as a public route in `MAIN_NAV`.
      Add an e2e spec that registers through the UI and asserts the lobby URL and the balance text.
    files:
      - apps/web/tests/e2e/player-accounts.spec.ts
    rationale: Covers AC9 and AC10 end to end. Whether the lobby already renders the balance for a signed-in player is verified by that test.
tests:
  - |
    AC1 (API, players.service.spec.ts) fails first because `register` has no name argument.
    ```ts
    const player = await service.register('Ana', ' ANA@example.com ', 'exactly8');
    expect(player.email).toBe('ana@example.com');
    expect(insertCall.params).toEqual(['Ana', 'ana@example.com', expect.any(String)]);
    ```
    Plus an e2e check in `services/api/test/session.e2e-spec.ts`: register, then `POST /session/sign-in` with the same email and password returns 200.
  - |
    AC2 (web, AuthForms.test.tsx and API).
    ```ts
    expect(await handleRegister(deps, '  ', 'a@b.co', 'play-2026')).toEqual({ name: 'Enter your name' });
    expect(deps.registerPlayer).not.toHaveBeenCalled();
    ```
    API: `await expect(service.register('', 'a@b.co', 'play-2026')).rejects.toBeInstanceOf(BadRequestException)`. The rendered markup shows the error in a `.field-error` span linked from the name input by `aria-describedby`.
  - |
    AC3 (web and API) with the email `player-at-example`.
    ```ts
    expect(await handleRegister(deps, 'Ana', 'player-at-example', 'play-2026')).toEqual({
      email: 'Enter an email like name@example.com',
    });
    ```
  - |
    AC4 (web, 409 maps to the email field).
    ```ts
    registerPlayer: vi.fn(async () => ({ ok: false as const, status: 409, message: 'x' }))
    expect(await handleRegister(deps, 'Ana', 'a@b.co', 'play-2026')).toEqual({ email: DUPLICATE_EMAIL_ERROR });
    ```
    API: a unique-violation (code 23505) on insert rejects with `ConflictException`. The e2e check registers the same email twice and the second call returns 409. A concurrency test fires `Promise.all([register(...), register(...)])` with the same email against the real database and expects exactly one success and one 409.
  - |
    AC5 (web and API) with a 7-character password.
    ```ts
    expect(await handleRegister(deps, 'Ana', 'a@b.co', '1234567')).toEqual({ password: 'Use at least 8 characters' });
    ```
  - |
    AC6 (web). With every field invalid, all three errors come back together and nothing navigates or calls the API.
    ```ts
    expect(await handleRegister(deps, '', 'nope', 'short')).toEqual({
      name: 'Enter your name', email: EMAIL_ERROR, password: PASSWORD_ERROR,
    });
    expect(deps.replace).not.toHaveBeenCalled();
    expect(deps.registerPlayer).not.toHaveBeenCalled();
    ```
    API e2e: a failed register sends no `set-cookie` header and creates no `players` row.
  - |
    AC7 (API). The same name is accepted for a different email, because there is no unique constraint or lookup on name.
    ```ts
    await service.register('Alex', 'a1@b.co', 'play-2026');
    await expect(service.register('Alex', 'a2@b.co', 'play-2026')).resolves.toMatchObject({ email: 'a2@b.co' });
    ```
    e2e: both can sign in.
  - |
    AC8 (web, markup test in AuthForms.test.tsx).
    ```ts
    const html = renderToStaticMarkup(<RegisterForm />);
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain('Already have an account? Sign in');
    ```
  - |
    AC9 (web, plus Playwright). It replaces the old "/wallet?welcome=1" assertion.
    ```ts
    expect(await handleRegister(deps, 'Ana', 'a@b.co', 'exactly8')).toEqual({});
    expect(deps.replace).toHaveBeenCalledWith('/lobby');
    ```
    Playwright: fill the form, submit, then `await expect(page).toHaveURL(/\/lobby$/)`. The test is in `apps/web/tests/e2e/player-accounts.spec.ts`.
  - |
    AC10 (API and Playwright). After registering, `GET /wallet` returns `balanceCredits` 1000, and the lobby shows the balance.
    ```ts
    expect(walletInsertParams).toEqual([player.id, 1000]);
    ```
    Playwright: `await expect(page.getByText('1,000')).toBeVisible()` on the lobby.
  - |
    AC11 (web and API) with a name of exactly 50 characters.
    ```ts
    expect(validateName('x'.repeat(50))).toBeNull();
    await expect(service.register('x'.repeat(50), 'a@b.co', 'play-2026')).resolves.toBeDefined();
    ```
  - |
    AC12 (web and API) with a name of 51 characters.
    ```ts
    expect(validateName('x'.repeat(51))).toBe('Use 50 characters or fewer');
    await expect(service.register('x'.repeat(51), 'a@b.co', 'play-2026')).rejects.toBeInstanceOf(BadRequestException);
    ```
  - |
    Existing rows after the migration (`005_player_name.sql`). Apply 001-004, insert a player without a name, apply 005 twice (idempotent), then check that the old player can still sign in and that `select name from players` returns null for that row.
assumptions_or_open_questions:
  - |
    CONFLICT: AC9 and the sketch's `register-done` flow say a new player lands on the lobby. Today `RegisterForm` goes to `/wallet?welcome=1`. The plan follows the AC and the sketch and changes the destination to `/lobby`, which changes the existing "lands on the wallet" test. The `?welcome=1` welcome note on the wallet page is then no longer reached from sign-up. It is left in place and not removed, since removal is not in scope.
  - |
    The sketch's lobby header shows a "Sign in" button and a "$250" balance badge. Those are placeholders for a guest. The signed-in top bar (name, balance, Sign out) belongs to the epic's other items, so this plan does not build it. It also does not show the player's name in the top bar. AC10 is checked against the balance that the existing `BalanceTile`/`TopBar` already render, and it is assumed they render a signed-in balance on `/lobby`. The e2e test verifies this.
  - |
    The sketch labels the currency "$" and the ACs say "1,000 free credits". The plan uses credits, as in the existing app.
  - |
    Name rules: the maximum is 50 characters, counted after trimming whitespace. Whether to trim, and how to count characters outside the BMP (emoji), is not stated. The plan counts UTF-16 code units in JS and `char_length` in SQL, which can differ for emoji. A human may want to confirm this.
  - |
    Deferred question (concurrent duplicate sign-ups): resolved here. The unique index on `players.email` (migration 001) makes the database the arbiter, and the 23505 error is mapped to a 409. No application-level lock is needed.
  - |
    Deferred questions on password storage, sign-in logging and monitoring, and on environments and data retention are not changed by this item. Passwords keep the existing scrypt hashing (`PasswordService`). Logging, environments and retention are left to their own items.
  - |
    Existing players have no name. The column is nullable and no backfill is done. Nothing in this item shows the name, so null is safe. A later top-bar item needs a fallback, for example the email.
  - |
    Login rate limiting per IP (`MAX_REGISTRATIONS_PER_IP`) is unchanged.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: migration 005 only adds a nullable `name` column and a check that allows null. Existing player rows stay valid and can sign in. No NOT NULL, no foreign key, no unique constraint.
  - **Backfill / seed**: none. Existing players keep a null name. The migration is idempotent (`add column if not exists`, constraint added only when missing), so re-running `services/api/scripts/migrate.ts` is safe.
  - **Settings**: no new env var or config.
  - **Provisioning**: nothing besides running `pnpm run migrate` in `services/api`.
  - **Order and rollback**: migrate before deploying the new API, because the insert writes `name`. The old API ignores the column, so the new column is safe if the code is rolled back. Roll back with `alter table players drop column name` if ever needed.

  ### Design and tokens
  The approved sketch is `PROD-28OCT-STORY-085-wireframe.yaml`: screens `lobby` (exit only) and `register`. Tokens are loaded by `apps/web/src/app/globals.css:2` (`@import "../../../../design-system/tokens.css"`). The form is styled only through the existing classes in that stylesheet, so no new token use or CSS is planned. The sketch's header on the register screen is the shared top bar, which is unchanged.

  ### Why the all-errors-at-once change
  `handleRegister` currently returns the first error, so only one field could be flagged per submit. The ACs only need one error each, but with all failing fields flagged, AC6 ("any field failing") reads correctly. Focus goes to the first invalid field.

  ```mermaid
  flowchart TD
    RP[register/page.tsx] --> RF[RegisterForm.tsx]
    RF -->|name, validate all fields, go to lobby| CR[credentials.ts]
    RF --> SS[lib/session.ts registerPlayer]
    SS -->|POST /session/register with name| SC[session.controller.ts]
    SC --> PS[players.service.ts]
    PS -->|insert name| MG[005_player_name.sql]
    PS --> PC[players.constants.ts]
    RF --> SH[lib/shell.ts LOBBY_HREF]
    classDef touched fill:#f96,color:#000
    class RF,CR,SS,SC,PS,MG,PC touched
  ```
review_focus: |
  IN scope: a name field on registration (web and API), the nullable `players.name` column, inline errors for name, email and password, and the redirect to `/lobby`. OUT: the signed-in top bar showing the name, sign-in changes, and removal of the wallet welcome note. The riskiest parts are the changed `register` signature, which touches every caller and test, and the duplicate-email race, which must rely on the unique index and not on a prior select. The redirect from `/wallet?welcome=1` to `/lobby` is deliberate, because AC9 and the sketch require it. The name column is nullable on purpose, so existing players keep working.
