summary: |
  Add self-service player accounts end to end. The Records API (NestJS + PostgreSQL) gets a players/wallet data model, register / sign-in / sign-out / session endpoints with a cookie session, and a per-player wallet endpoint. Registering creates the player and a wallet holding the one-time 1,000 credit starting grant in a single transaction, so signing in again never grants twice. The Web App (Next.js) gets /sign-in, /register and /wallet pages built from the approved prototype, a signed-out redirect for the wallet, and a Wallet entry in the top bar nav. The existing top bar Sign out (TopBarControls, lib/session.ts) is reused unchanged apart from the endpoints it talks to. Social login, external accounts, top-up, bets and history are out of scope.
scope:
  - description: |
      API: Postgres access and schema. Add a `DatabaseModule` exposing a `pg` Pool (connection from `DATABASE_URL`) and a SQL migration creating `players` (id uuid PK, email citext-or-lowercased UNIQUE, password_hash text, created_at), `wallets` (player_id PK/FK to players, balance_credits bigint NOT NULL CHECK >= 0) and `sessions` (token_hash PK, player_id FK, expires_at). Plus a tiny migration runner script run before start.
    files:
      - services/api/src/database/database.module.ts
      - services/api/src/database/database.service.ts
      - services/api/migrations/001_players_wallets_sessions.sql
      - services/api/scripts/migrate.ts
      - services/api/package.json
    rationale: |
      The API has no database layer yet (app.module.ts only imports RecordsModule). Unique email and wallet PK are what enforce AC5/AC7 under concurrency, not application checks.
  - description: |
      API: password hashing and accounts service. `PasswordService` using node:crypto scrypt with a per-password random salt and timingSafeEqual (no new dependency). `PlayersService.register(email, password)` normalises email (trim, lowercase), validates (email shape, password of 8+ characters, matching the prototype), and in ONE transaction inserts the player and a wallet with `STARTING_GRANT = 1000`; a unique violation (23505) maps to `ConflictException`. `PlayersService.authenticate(email, password)` returns the player or null; it must run a dummy hash compare for an unknown email so both failure paths look the same.
    files:
      - services/api/src/players/password.service.ts
      - services/api/src/players/players.service.ts
      - services/api/src/players/players.constants.ts
      - services/api/src/players/players.module.ts
    rationale: |
      Grant lives in the same transaction as account creation, so there is exactly one grant per account by construction (AC4, AC5). Sign-in never touches the wallet.
  - description: |
      API: session and auth controller. `SessionService` issues a random 32-byte token, stores only its SHA-256, sets an HttpOnly, SameSite=Lax, Secure-in-production cookie `session`, and resolves a cookie to a player. Routes, matching the contract already assumed by apps/web/src/lib/session.ts and the /session/* rewrite in next.config.ts:
      `POST /session/register` (201, body email+password, signs in), `POST /session/sign-in` (200; 401 with message 'Email or password incorrect' on any failure), `POST /session/sign-out` (204, deletes session row and clears cookie), `GET /session` (200 `{ role: 'player', email }`, or 401). A `SessionGuard` populates `req.player`. Cookie parsing is done by hand to avoid adding cookie-parser.
    files:
      - services/api/src/session/session.service.ts
      - services/api/src/session/session.controller.ts
      - services/api/src/session/session.guard.ts
      - services/api/src/session/session.module.ts
      - services/api/src/app.module.ts
    rationale: |
      Reuses the existing /session URL contract so getSession() and signOut() keep working without signature changes (the file's own comment calls them the seam for this story). A wrong password then a right one just works (AC9) because failed attempts keep no state; no lockout is added, as none is in the ACs.
  - description: |
      API: wallet endpoint. `GET /wallet` behind `SessionGuard` returns `{ balanceCredits: number }` for the session's own player only (the player id comes from the session, never from the URL or body), 401 when signed out.
    files:
      - services/api/src/wallet/wallet.controller.ts
      - services/api/src/wallet/wallet.service.ts
      - services/api/src/wallet/wallet.module.ts
      - services/api/src/app.module.ts
    rationale: |
      AC4, AC5, AC6 and the API half of AC10. Deriving the wallet from the session is what keeps players isolated from each other.
  - description: |
      Web: session client and routing seam. Extend lib/session.ts with client calls `registerPlayer(email, password)` and `signInPlayer(email, password)` (POST to /session/register and /session/sign-in with credentials include, typed result of ok or a message) and a server `getWalletBalance()` that forwards the cookie header like getSession(). `getSession` type becomes `{ role: string; email?: string } | null` (backwards compatible). Add `WALLET_HREF = '/wallet'` and `REGISTER_HREF = '/register'` and append `{ key: 'wallet', label: 'Wallet', href: '/wallet' }` to MAIN_NAV in lib/shell.ts (appended at the end so Home stays first).
    files:
      - apps/web/src/lib/session.ts
      - apps/web/src/lib/shell.ts
      - apps/web/next.config.ts
    rationale: |
      next.config.ts already rewrites /session/:path*; add a `/wallet-api/:path*` style rewrite only if the server-side wallet read is done from the browser. Preferred: wallet read is server side via RECORDS_API_URL, so next.config.ts may need no change; drop it from the diff if unused.
  - description: |
      Web: pages from the approved prototype. Screens: "Sign in" (#sign-in), "Create account" (#register), "Wallet" (#wallet). Build `SignInForm` and `RegisterForm` client components (`.card.stack` form, `.field` + `.input` + label, `.field-error` + `.is-invalid` + aria-invalid for validation, `.alert.alert-danger role=alert tabindex=-1` focused on failure, `.btn.btn-primary` submit with pending label 'Signing in…' / 'Creating account…', `.text-sm` link to the other form, narrow column of `size-modal`). Sign-in keeps the email and clears only the password after a failure (AC8, AC9). Register shows `Enter an email like name@example.com` and `Use at least 8 characters` and, on 409, the duplicate-email alert 'An account with this email already exists. Sign in instead, or use a different email.' (AC7). Success calls `router.replace('/wallet')` then `router.refresh()` so the layout's getSession re-renders the top bar as signed in (AC1, AC2). The sign-in page shows the info alert 'Sign in to see your wallet.' when `?next=wallet` is present. The wallet page (server component) shows the h1 'Wallet', a `.card.balance-tile` with 'Credit balance' and the figure formatted `1,000 credits`, 'Signed in as <email>', and, only right after registration (`?welcome=1`), the `.alert-success` 'Welcome! We added 1,000 credits to your new wallet.'. An app/wallet/loading.tsx renders the `.skeleton` card. A server-side redirect to `/sign-in?next=wallet` happens when getSession() is null (AC10). Add the few missing prototype classes to globals.css using tokens only: `.card`, `.stack`, `.stack-2/-4`, `.field`, `.field-error`, `.field-hint`, `.input`, `.is-invalid`, `.text-muted`, `.text-sm`, `.alert-info`, `.alert-success`, `.btn-primary`, `.skeleton`, `.balance-tile` (border-left var(--border-width-strong) solid var(--color-primary)), `.balance-figure` (font-size calc(var(--font-size-xl) * 1.5), var(--font-weight-semibold)), `.narrow` (max-width var(--size-modal)). Tokens are already loaded by `@import "../../../../design-system/tokens.css"` at apps/web/src/app/globals.css line 2; no new token loading is needed.
    files:
      - apps/web/src/app/sign-in/page.tsx
      - apps/web/src/app/register/page.tsx
      - apps/web/src/app/wallet/page.tsx
      - apps/web/src/app/wallet/loading.tsx
      - apps/web/src/components/SignInForm.tsx
      - apps/web/src/components/RegisterForm.tsx
      - apps/web/src/components/BalanceTile.tsx
      - apps/web/src/lib/credentials.ts
      - apps/web/src/app/globals.css
    rationale: |
      TopBar and TopBarControls are reused as is (no new top bar component); the prototype states new components: none for the shell. SignInForm/RegisterForm/BalanceTile are new because no form or balance component exists in the catalogue. The redirect is done in the server page so a signed-out visitor never gets a flash of wallet content.
  - description: |
      Web: e2e seam. Extend tests/e2e/mock-session-server.mjs only if the Playwright specs need register/sign-in/wallet responses; real behaviour is covered by the API e2e (supertest) against Postgres.
    files:
      - apps/web/tests/e2e/mock-session-server.mjs
      - apps/web/tests/e2e/player-accounts.spec.ts
    rationale: |
      The mock stands in for the API; the new flows need it to answer the new routes for the browser-level checks of AC3 and AC10.
tests:
  - |
    AC1 (API, supertest, services/api/test/session.e2e-spec.ts) — register signs the visitor in.
    ```ts
    const res = await agent.post('/session/register').send({ email: 'ana@example.com', password: 'play-2026' });
    expect(res.status).toBe(201);
    expect((await agent.get('/session')).status).toBe(200);
    ```
    Web unit (RegisterForm.test.tsx): on a 201 from registerPlayer the form calls `replace('/wallet')`.
  - |
    AC2 — signing in with the right credentials gives a session.
    ```ts
    await request(app).post('/session/register').send(creds);
    const res = await request(app).post('/session/sign-in').send(creds);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/session=.*HttpOnly/);
    ```
  - |
    AC3 — sign out ends the session (API) and the existing top bar button still drives it. Existing TopBar.test.tsx and handleSignOut cases must keep passing.
    ```ts
    await agent.post('/session/sign-out').expect(204);
    expect((await agent.get('/session')).status).toBe(401);
    ```
    Playwright (player-accounts.spec.ts): click `getByRole('button', { name: 'Sign out' })` then `await expect(page).toHaveURL(/\/sign-in$/)`.
  - |
    AC4 — new account balance is 1,000.
    ```ts
    await agent.post('/session/register').send(creds);
    expect((await agent.get('/wallet')).body).toEqual({ balanceCredits: 1000 });
    ```
    Unit (players.service.spec.ts): register issues the player insert and the wallet insert with `STARTING_GRANT` inside one transaction (BEGIN ... COMMIT), and ROLLBACK when the wallet insert throws.
  - |
    AC5 — no second grant after sign out and back in.
    ```ts
    await agent.post('/session/sign-out');
    await agent.post('/session/sign-in').send(creds);
    expect((await agent.get('/wallet')).body.balanceCredits).toBe(1000);
    const { rows } = await pool.query('select count(*)::int as n from wallets');
    expect(rows[0].n).toBe(1);
    ```
  - |
    AC6 — two players are isolated.
    ```ts
    await pool.query('update wallets set balance_credits = 640 where player_id = (select id from players where email = $1)', ['ben@example.com']);
    expect((await ana.get('/wallet')).body.balanceCredits).toBe(1000);
    expect((await ben.get('/wallet')).body.balanceCredits).toBe(640);
    ```
  - |
    AC7 — duplicate email refused (also with different letter case and surrounding spaces).
    ```ts
    await request(app).post('/session/register').send(creds).expect(201);
    const res = await request(app).post('/session/register').send({ ...creds, email: ' ANA@example.com ' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
    ```
    Web: RegisterForm shows the alert text on 409 and keeps the typed email.
  - |
    AC8 — wrong password shows the message, and an unknown email gives the identical response.
    ```ts
    const res = await request(app).post('/session/sign-in').send({ email: 'ana@example.com', password: 'nope-nope' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Email or password incorrect');
    ```
    Web (SignInForm.test.tsx): `expect(screen.getByRole('alert')).toHaveTextContent('Email or password incorrect')`, the email input keeps its value and the password is cleared.
  - |
    AC9 — right password after a wrong one signs in.
    ```ts
    await request(app).post('/session/sign-in').send({ ...creds, password: 'wrong-wrong' }).expect(401);
    await request(app).post('/session/sign-in').send(creds).expect(200);
    ```
  - |
    AC10 — signed-out wallet redirects to sign-in.
    ```ts
    expect((await request(app).get('/wallet')).status).toBe(401);
    ```
    Web: wallet page test mocks getSession to null and asserts `redirect` was called with '/sign-in?next=wallet'. Playwright: `await page.goto('/wallet'); await expect(page).toHaveURL(/\/sign-in/)`.
  - |
    Supporting unit tests written first: password.service.spec.ts (`verify(hash(p), p)` is true, a wrong password is false, two hashes of the same password differ); shell.test.ts updated so `visibleNav(true)` ends with the `wallet` entry and `visibleNav(false)` is still empty; credentials.test.ts for the email and 8-character rules.
assumptions_or_open_questions:
  - |
    The AC8 message is written in lower case ('email or password incorrect') but the approved prototype and the UI guidelines (sentence case) show 'Email or password incorrect'. The plan uses the sentence-case form; tests compare it exactly. Please confirm, or tell me to use the lower-case wording.
  - |
    Migrations: the API has no migration tooling or database module today (I read services/api/src and package.json). The plan uses plain SQL files plus a small scripts/migrate.ts runner and the `pg` driver rather than an ORM, because the stack lists only 'postgresql'. Say so if the team wants TypeORM/Prisma instead.
  - |
    Session design is mine: an opaque random token in an HttpOnly cookie, SHA-256 hashed in a sessions table, 7 day expiry. ADR-0011 says 'Built-in authentication' but I did not open the ADR body; the plan should be checked against it. Session lifetime is an open choice.
  - |
    Password policy is only the prototype's 8-character minimum. No lockout or rate limiting on sign-in is planned (not in the ACs); worth a follow-up given the 'wrong password then right password' AC9.
  - |
    Prototype nav comment says 'Home · Wallet' but its nav markup shows only Home. The plan appends Wallet to MAIN_NAV for signed-in players, as the UI guidelines say new sections go at the end. The prototype's visitor home (Sign in / Create account / Open my wallet buttons) is NOT built: the current app sends signed-out visitors to /sign-in (brandHref), and the ACs do not ask for a visitor home. The prototype's Sign in link in the header is also not added, since the top bar only shows the brand when signed out; /sign-in links to /register instead.
  - |
    The 'Prototype control' demo box and the hard-coded demo accounts in the prototype are prototype-only and are not built.
  - |
    Deferred questions (retention of wallet and history records, concurrent player count, backups) do not change this story: it stores only the balance, not transactions. I did not add a wallet_transactions ledger; the epic's later history story would add it, and the grant would then need a ledger row backfilled. The decision 'balance must be greater than the applied bet' belongs to the betting/top-up stories and is not used here.
  - |
    Both lowercase email normalisation and a UNIQUE index on the stored lowercased value are assumed for 'email already in use'.
estimated_points: 8
package_dependencies:
  - name: pg
    version: ^8.13.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: PostgreSQL driver for the Records API; no database client is a dependency of services/api today.
  - name: "@types/pg"
    version: ^8.11.0
    ecosystem: npm
    component_id: comp_records_api
    rationale: Types for pg under strict TypeScript.
notes: |
  ### Data & rollout

  - **Existing data**: new tables only (`players`, `wallets`, `sessions`); no existing table is altered, so no existing rows are affected.
  - **Backfill / seed**: none. No seeded accounts; the 1,000 credit grant is written at registration time. The migration uses `create table if not exists`, so re-running it is safe.
  - **Settings**: `DATABASE_URL` (required by the API; no default, the API fails fast at start when unset) and `SESSION_COOKIE_SECURE` (default: on when NODE_ENV is production). `RECORDS_API_URL` already exists for the web app. Document in services/api/README or the existing env docs if one exists (not checked).
  - **Provisioning**: a PostgreSQL database reachable from the API (comp_relational_database) and the migration run once per environment before the new API version starts: `cd services/api && pnpm exec ts-node scripts/migrate.ts`.
  - **Order and rollback**: migrate, then deploy the API, then the web app (the web pages call endpoints that must exist). Rollback is to redeploy the previous versions; the tables are additive and harmless to leave in place.

  Tests also need a Postgres for the API e2e (`pnpm run e2e`); the default `pnpm run test` unit command stays database-free by mocking the Pool.

  ```mermaid
  flowchart TD
    Layout[app/layout.tsx getSession] --> Session[lib/session.ts]
    TopBarControls[TopBarControls signOut] --> Session
    Session -->|rewrite /session/*| SessionCtl[session.controller.ts]
    SignIn[SignInForm / RegisterForm] --> Session
    WalletPage[app/wallet/page.tsx] --> Session
    WalletPage -->|GET /wallet| WalletCtl[wallet.controller.ts]
    SessionCtl --> PlayersSvc[players.service.ts]
    SessionCtl --> SessionSvc[session.service.ts]
    WalletCtl --> SessionGuard[session.guard.ts]
    PlayersSvc --> Db[(Postgres via database.service.ts)]
    WalletCtl --> Db
    AppModule[app.module.ts] --> SessionCtl
    AppModule --> WalletCtl
    classDef touched fill:#f96,color:#000
    class Session,SessionCtl,PlayersSvc,SessionSvc,WalletCtl,SessionGuard,Db,SignIn,WalletPage,AppModule touched
  ```
review_focus: |
  IN: email/password register, sign-in, sign-out, the one-time 1,000 credit grant, per-player wallet balance read, signed-out redirect. OUT: social login, external accounts, top-up, bets, history, rate limiting. Riskiest part is the grant: it must be written in the same transaction as account creation and never on sign-in, and duplicate email must be enforced by a unique index, not a pre-check. Deliberate: the AC8 message uses the prototype's sentence case, the API contract reuses the existing /session URLs from lib/session.ts, and the prototype's visitor home and demo box are intentionally not built.
