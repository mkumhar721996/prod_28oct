summary: |
  Deliver the first in-app alert end to end. The Background Worker (pg-boss) consumes a `alerts.money-received` queue and inserts one alert row per (customer, event) into a new `alerts` table, using a unique key plus `on conflict do nothing` so replays and retries never duplicate. The Records API gets an `alerts` module (list own alerts newest first, unread count, mark one read) behind the existing SessionGuard. The Web App gets an unread-count badge link in the top bar that refreshes about every 30 seconds, an `/alerts` screen (skeleton, error with retry, empty state, unread/read cards with amount and sender, Mark as read) that matches the approved prototype. No settings, muting, push or other event types. The word "customer" in the item is the app's `player` (players table, session player id).

scope:
  - description: |
      Migration `005_alerts.sql`: new table `alerts` (id uuid pk default gen_random_uuid(), player_id uuid not null references players(id), kind text not null, event_id text not null, amount_minor bigint not null check (amount_minor > 0), currency text not null, sender_name text not null, read_at timestamptz null, created_at timestamptz not null default now()). Unique index `alerts_player_event_uniq` on (player_id, kind, event_id) is what makes processing once-only (AC 2). Index `alerts_player_created_idx` on (player_id, created_at desc, id desc) for the list; partial index `alerts_player_unread_idx` on (player_id) where read_at is null for the count. Uses `create table/index if not exists` like 003.
    files:
      - services/api/migrations/005_alerts.sql
    rationale: |
      Mirrors 003_appointments.sql (same style, idempotent re-run). Alerts are stored once; read state is a nullable timestamp so "mark read" is naturally idempotent.
  - description: |
      Worker job. In `services/worker/src/jobs/moneyReceived.ts` export `MONEY_RECEIVED_QUEUE = 'alerts.money-received'`, the payload type and `createMoneyReceivedJob(db: { query: Pool['query'] }): JobDefinition<MoneyReceivedEvent>`. The handler validates the payload (throws on a bad one so pg-boss retries/fails it rather than silently dropping) then runs:
      ```ts
      export type MoneyReceivedEvent = { eventId: string; recipientId: string; senderName: string; amountMinor: number; currency: string };
      await db.query(
        `insert into alerts (player_id, kind, event_id, amount_minor, currency, sender_name)
         values ($1, 'money_received', $2, $3, $4, $5)
         on conflict (player_id, kind, event_id) do nothing`,
        [recipientId, eventId, amountMinor, currency, senderName],
      );
      ```
      In `jobs/index.ts` add `export function buildJobs(db): JobDefinition<any>[]` returning the existing `jobs` plus the new job (keep the `jobs` and `handleNotification` exports so jobs.test.ts still passes). In `worker.ts` create a `pg.Pool` from `config.databaseUrl`, use `buildJobs(pool)`, create the queue with `retryLimit: 5, retryBackoff: true`, call `boss.work(name, { pollingIntervalSeconds: 1 }, ...)` for the new queue, and close the pool in shutdown. Add `pg` and `@types/pg` to the worker (see package_dependencies).
    files:
      - services/worker/src/jobs/moneyReceived.ts
      - services/worker/src/jobs/index.ts
      - services/worker/src/worker.ts
      - services/worker/src/index.ts
      - services/worker/package.json
    rationale: |
      Missed events are covered by the durable pg-boss queue with retries; duplicates by the unique key, so retries and replays are safe. A 1 second poll keeps processing well inside the 10 seconds of AC 11.
  - description: |
      Records API `alerts` module following the wallet/appointments pattern (`@UseGuards(SessionGuard)`, player id from `req.player.id` only). `AlertsService`: `listFor(playerId): Promise<AlertView[]>` (`... where player_id = $1 order by created_at desc, id desc`), `unreadCountFor(playerId): Promise<number>` (`select count(*) from alerts where player_id = $1 and read_at is null`), `markRead(playerId, id): Promise<AlertView | null>`:
      ```ts
      update alerts set read_at = coalesce(read_at, now()) where id = $1 and player_id = $2 returning ...
      ```
      so a second session or double click is a no-op, and another customer's alert id returns null (controller throws NotFoundException, never leaking existence). A non-uuid id is a 404 as well (validate with a uuid regex before querying). Routes: `GET /alerts`, `GET /alerts/unread-count` returning `{ count }`, `POST /alerts/:id/read` returning the alert. `AlertView = { id, kind: 'money_received', amountMinor, currency, senderName, read: boolean, createdAt: string }`. Register `AlertsModule` in `app.module.ts`.
    files:
      - services/api/src/alerts/alerts.module.ts
      - services/api/src/alerts/alerts.service.ts
      - services/api/src/alerts/alerts.controller.ts
      - services/api/src/app.module.ts
    rationale: |
      The unread count is always derived from the database, so two sessions marking the same alert read, or one marking while another polls, converge on the right number with no extra locking.
  - description: |
      Web data layer `apps/web/src/lib/alerts.ts`: `Alert` type, `fetchAlerts(): Promise<Alert[]>` and `fetchUnreadCount(): Promise<number>` (both reject on non-2xx), `markAlertRead(id): Promise<Alert>`, `formatAmount(amountMinor, currency)` via `Intl.NumberFormat` (minor units divided by 100), and `UNREAD_REFRESH_MS = 30_000`, `LIST_REFRESH_MS = 5_000`. Browser calls go to `/api/alerts` with `credentials: "include"` like lib/appointments.ts. `next.config.ts` gets rewrites for `/api/alerts` and `/api/alerts/:path*` (same reason as the others: `/alerts` is the page). `lib/shell.ts` gets `ALERTS_HREF = "/alerts"` and an `alerts` entry in `NEXT_TARGETS`.
    files:
      - apps/web/src/lib/alerts.ts
      - apps/web/next.config.ts
      - apps/web/src/lib/shell.ts
    rationale: |
      Same client/rewrite convention as appointments and orders.
  - description: |
      Unread count in the top bar. New `UnreadCountProvider` (client, mounted in `layout.tsx` inside CartProvider, receives `signedIn`) holds `count: number | null`, fetches on mount and every `UNREAD_REFRESH_MS` with `setInterval`, skips the tick while `document.hidden`, keeps the last known count when a poll fails (no error flash for a background refresh; the next tick retries), and exposes `setCount` / `refresh` so AlertsScreen can update the badge immediately after a mark-read. It does nothing when signed out. `TopBar` gets an optional `unreadCount?: number | null` prop and, when signed in, renders to the right of the nav (before Sign out) a link `<a href="/alerts" data-nav-key="alerts" aria-label="Alerts, N unread">` with the bell icon, the word "Alerts", and a `.badge .badge-danger` showing `N unread` only when N is above 0. `TopBarControls` reads the count from the provider and passes it down.
    files:
      - apps/web/src/components/alerts/UnreadCountProvider.tsx
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBarControls.tsx
      - apps/web/src/app/layout.tsx
    rationale: |
      TopBar stays a pure presentational component (as its existing tests expect); polling lives in the provider. The shared count means marking read updates the top bar straight away (AC 8) while other sessions catch up within 30 seconds (AC 4).
  - description: |
      Alerts screen at `/alerts`, built from the prototype's "Alerts list" and "Alerts list, no alerts" screens. `app/alerts/page.tsx` is a server component that redirects signed-out visitors to sign-in with `?next=alerts` (as appointments/page.tsx does) and renders `AlertsScreen`. `AlertsScreen` (client) fetches the list on mount and every `LIST_REFRESH_MS`, and shows: skeleton (two `.skeleton` bars of height `var(--space-6)`) while loading; `.alert .alert-danger role="alert"` "We couldn't load your alerts. Check your connection and try again." with a `.btn-secondary .btn-sm` "Try again"; the empty state `.empty-state` with bell icon, h2 "No alerts yet", "When you receive money, you'll see it here." and a `.btn-primary` "Back to home" link; otherwise a `.stack` of `AlertCard`s, newest first. Title row is h1 "Alerts" plus the unread `.badge-danger` (hidden at 0), `role="status" aria-live="polite"`. `AlertCard` is a `.card` with a `var(--border-width-strong)` left rule, `var(--color-primary)` when unread: h3 "Money received", `.badge-info` "Unread" or `.badge-neutral` "Read", the amount ("Amount received: $120.00", `var(--font-size-lg)` semibold), "From: <sender>", the time (reuse LocalTime, muted `.text-sm`), and for unread cards a `.btn-secondary` "Mark as read" that disables and reads "Marking as read…" while pending, then updates the card, calls the provider's `setCount`, and shows the existing `Toast` "Alert marked as read". A failed mark-read keeps the card unread and shows an inline `.alert-danger` "We couldn't mark that alert as read. Try again." Text in cards uses `overflow-wrap: anywhere` so long sender names do not overflow.
    files:
      - apps/web/src/app/alerts/page.tsx
      - apps/web/src/components/alerts/AlertsScreen.tsx
      - apps/web/src/components/alerts/AlertCard.tsx
      - apps/web/src/components/alerts/NoAlerts.tsx
      - apps/web/src/app/globals.css
    rationale: |
      Reuses TopBar, LocalTime (components/history), Toast (components/appointments) and the orders Icon helper (extend it with the bell glyph if it lacks one); the only new CSS is the card's left rule and meta wrap in globals.css, using tokens only (`--border-width-strong`, `--color-primary`, `--space-*`, `--font-size-lg`, `--font-weight-semibold`). No new colours or pixel literals.

tests:
  - |
    AC 1 (worker, services/worker/test/moneyReceived.test.ts). Written first, fails because the module does not exist.
    ```ts
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    await createMoneyReceivedJob({ query }).handler({ eventId: 'evt_1', recipientId: 'p1', senderName: 'Sam Okafor', amountMinor: 12000, currency: 'USD' });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(['p1', 'evt_1', 12000, 'USD', 'Sam Okafor']);
    expect(query.mock.calls[0][0]).toContain("'money_received'");
    ```
    Plus: an event with a missing or non-positive amount rejects (`await expect(handler({ ...e, amountMinor: 0 })).rejects.toThrow()`) and issues no query. Plus: the queue is registered (`expect(buildJobs(db).map(j => j.name)).toContain(MONEY_RECEIVED_QUEUE)`).
  - |
    AC 2 (worker plus migration, same file). Handling the same event twice is safe because of the SQL, so pin both halves:
    ```ts
    expect(query.mock.calls[0][0]).toContain('on conflict (player_id, kind, event_id) do nothing');
    const sql = readFileSync(join(__dirname, '../../api/migrations/005_alerts.sql'), 'utf8');
    expect(sql).toMatch(/unique index if not exists alerts_player_event_uniq\s+on alerts \(player_id, kind, event_id\)/);
    await job.handler(e); await expect(job.handler(e)).resolves.toBeUndefined(); // a conflict (rowCount 0) is not an error
    ```
    Also an optional real-PostgreSQL check in services/api/test/alerts.e2e-spec.ts (needs DATABASE_URL like wallet.e2e-spec.ts) inserting the same event twice and asserting `select count(*)` is 1.
  - |
    AC 3 (web). apps/web/src/components/TopBar.test.tsx and UnreadCountProvider.test.tsx. TopBar renders the count:
    ```ts
    const html = renderToStaticMarkup(<TopBar signedIn pathname="/" unreadCount={2} />);
    expect(html).toContain("2 unread");
    expect(html).toMatch(/<a[^>]*data-nav-key="alerts"[^>]*aria-label="Alerts, 2 unread"/);
    ```
    And signed out shows no alerts link; count 0 or null shows no badge. Provider (vitest fake timers, mocked `fetchUnreadCount` resolving 2): after mount and flushing promises the context count is 2.
  - |
    AC 4 (web, UnreadCountProvider.test.tsx) with `vi.useFakeTimers()`:
    ```ts
    fetchUnreadCount.mockResolvedValueOnce(2).mockResolvedValue(3);
    // mount, flush -> 2
    await vi.advanceTimersByTimeAsync(29_000); expect(shown()).toBe(2);
    await vi.advanceTimersByTimeAsync(1_000);  expect(shown()).toBe(3);
    ```
    And a rejected poll keeps the last count (`mockRejectedValueOnce(new Error('x'))` then still 2, next tick recovers), and no fetch happens while `document.hidden` is true or when `signedIn` is false.
  - |
    AC 5 (API + web). alerts.service.spec.ts: `await service.listFor('p1')` runs the query with params `['p1']` and maps every row to `{ id, kind: 'money_received', amountMinor, currency, senderName, read, createdAt }`, including the money-received row. alerts.controller.spec.ts: `GET /alerts` calls `listFor(req.player.id)`. AlertsScreen.test.tsx: with mocked `fetchAlerts` returning two alerts, `expect(html).toContain("Money received")` appears twice.
  - |
    AC 6 (API). The player id comes from the session only, never the request:
    ```ts
    expect(query.mock.calls[0][0]).toContain('where player_id = $1');
    expect(query.mock.calls[0][1]).toEqual(['customerA']);
    ```
    Controller spec: `list({ player: { id: 'A' } })` calls the service with 'A' and the route takes no id param. markRead for a customer B alert: service returns null when the update returns no rows and the controller throws NotFoundException (`await expect(controller.read(reqA, idOfB)).rejects.toBeInstanceOf(NotFoundException)`), with the SQL containing `and player_id = $2`.
  - |
    AC 7 (API + web). Service: `markRead('p1', id)` SQL contains `set read_at = coalesce(read_at, now())`, params `[id, 'p1']`, returns `read: true`; calling it again on an already-read alert still returns the alert (idempotent). AlertsScreen.test.tsx: click "Mark as read" on an unread card, `markAlertRead` mocked resolved; afterwards the card shows "Read" and has no "Mark as read" button; while pending the button is disabled with text "Marking as read…"; on rejection the card stays unread and the inline error text is shown.
  - |
    AC 8 (web, AlertsScreen.test.tsx with a provider test double). Three unread alerts, provider count 3; after marking one read:
    ```ts
    expect(setCount).toHaveBeenCalledWith(2);
    expect(screen.getByRole('status')).toHaveTextContent('2 unread');
    ```
    The new count is the number of unread alerts left in the list, so the top bar shows 2 straight away, not after the next 30 second refresh.
  - |
    AC 9 (API + web). Service: `expect(query.mock.calls[0][0]).toContain('order by created_at desc, id desc')`. Migration spec: the sql contains `alerts_player_created_idx` on `(player_id, created_at desc, id desc)`. AlertsScreen: render a list API-ordered newest first and assert the DOM order of the amounts equals the input order (the screen does not re-sort ascending, which the prototype's `.slice().reverse()` of an oldest-first fixture would otherwise suggest).
  - |
    AC 10 (web, AlertsScreen.test.tsx and NoAlerts.test.tsx). With `fetchAlerts` resolving `[]`:
    ```ts
    expect(html).toContain("No alerts yet");
    expect(html).toContain("When you receive money, you&#x27;ll see it here.");
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Back to home</);
    ```
    No unread badge is rendered at 0. While loading, two `.skeleton` elements are present; a rejected fetch shows the `role="alert"` message and a "Try again" button that refetches.
  - |
    AC 11 (worker + web). Worker: `boss.work` is called for the money-received queue with `{ pollingIntervalSeconds: 1 }` (spy on a fake PgBoss in worker.test.ts), so processing latency is about 1 second. Web: with fake timers, `fetchAlerts` first resolves `[]` then one alert; after `vi.advanceTimersByTimeAsync(LIST_REFRESH_MS)` the open list shows the money-received alert, and `expect(LIST_REFRESH_MS).toBeLessThan(10_000)`.
  - |
    AC 12 (web, AlertCard.test.tsx and alerts.test.ts).
    ```ts
    expect(formatAmount(12000, 'USD')).toBe('$120.00');
    expect(renderToStaticMarkup(<AlertCard alert={a} />)).toContain('Amount received: $120.00');
    ```
  - |
    AC 13 (web, AlertCard.test.tsx).
    ```ts
    expect(renderToStaticMarkup(<AlertCard alert={{ ...a, senderName: 'Sam Okafor' }} />)).toContain('From: Sam Okafor');
    ```
    The sender name is rendered as text only (React escaping), with a test that `<b>x</b>` as a name is escaped.
  - |
    Wiring checks. shell.test.ts: `ALERTS_HREF === "/alerts"` and `signInTarget("alerts") === "/alerts"`. alerts page.test.tsx: signed-out visitors are redirected to `/sign-in?next=alerts`. A layout or provider test confirms no polling starts when signed out. Run each narrow: `(cd services/worker && pnpm test -- moneyReceived)`, `(cd services/api && pnpm run test -- alerts)`, `(cd apps/web && pnpm test -- alerts TopBar)`.

assumptions_or_open_questions:
  - |
    Event producer (needs a human answer). No money-transfer or "money received" feature exists in the code I read (grep of services and apps/web found no transfer or sender concept; the wallet only has bet, win, topup and grant). This plan builds only the consumer: the worker handles messages on the pg-boss queue `alerts.money-received` with payload `{ eventId, recipientId, senderName, amountMinor, currency }`. Who publishes that message (and a stable `eventId` per transfer) is outside this item and must be agreed before release; until then alerts can only be created by sending the job directly.
  - |
    Currency and units. The prototype formats amounts as USD (`$120.00`) while the wallet uses integer credits. I assumed the event carries minor units plus an ISO currency code and the alert stores both. Confirm that money-received amounts are real currency and not credits.
  - |
    Answer to "how does the worker pick up events and avoid duplicates or misses": a durable pg-boss queue (retries with backoff, `retryLimit: 5`) plus a unique key on (player_id, kind, event_id) and `on conflict do nothing`. Events that exhaust retries stay in pg-boss's failed state for an operator; no dead-letter alerting is built here.
  - |
    Answer to the polling question: the top bar polls every 30 seconds (`UNREAD_REFRESH_MS`), pauses while the tab is hidden, keeps the last known count on a failed poll (silent, retried next tick) and the list shows a retryable error only on a failed list load. Concurrent mark-as-read from two sessions is safe: marking is idempotent (`coalesce(read_at, now())`) and the count is always recomputed from the database; the other session catches up at its next poll.
  - |
    List freshness. AC 11 says the list shows the alert after 10 seconds; I made the open list refetch every 5 seconds (`LIST_REFRESH_MS`) so it appears without a manual reload. Say if on-open fetch only is enough.
  - |
    Prototype vs shell. The prototype notes that the header has no bell or unread-count slot and shows the count in page content as a stand-in. AC 3 asks for the top bar, so this plan adds the bell link with badge to the right of the nav (per the UI guidelines) and does not add the prototype's stand-in "Alerts" button on the Home page. The prototype's "Prototype controls" panels are demo-only and are not built.
  - |
    Not decided by the item, so not built: alert history retention (project-wide open question) and list pagination. `GET /alerts` returns all of a customer's alerts as AC 5 says; fine at roughly 500 users (ADR-0006) but it needs a cap or paging once retention is decided. Backup and retention questions from the chore are not affected by this plan.
  - |
    The worker needs a direct database client (`pg`); today it only has pg-boss. I assumed a second pool on the existing `DATABASE_URL` is acceptable (the stack note says the worker owns no datastore, so the alerts table and its migration live with the Records API, which owns schema).
  - |
    Design tokens. I did not read `design-system/` or the web app's token import for this plan; the prototype's token names (`--space-*`, `--color-primary`, `--border-width-strong`, `--font-size-lg`) are the ones used, and the web app's globals.css already defines `.badge-danger`, `.toast`, `.title-row` and `.plain-list`. The implementer should confirm `.badge-info`, `.badge-neutral`, `.skeleton` and `.empty-state` exist in globals.css and add only missing ones from tokens.

estimated_points: 8

package_dependencies:
  - name: pg
    version: ^8.23.1
    ecosystem: npm
    component_id: comp_background_worker
    rationale: |
      The worker must write alerts rows to PostgreSQL; it currently depends only on pg-boss. Same version the Records API already pins.
  - name: "@types/pg"
    version: ^8.23.1
    ecosystem: npm
    component_id: comp_background_worker
    rationale: |
      Type declarations for pg in the worker (dev dependency), same version as the Records API.

notes: |
  ### Data & rollout

  - **Existing data**: the migration only adds a new table with foreign key to `players`; no existing row is touched or reinterpreted. No alerts exist for customers before deploy, and none are backfilled (past transfers are not alerted).
  - **Backfill / seed**: none. `005_alerts.sql` uses `create table/index if not exists`, so re-running it is safe.
  - **Settings**: no new env var. The worker reuses `DATABASE_URL` (already required by `services/worker/src/config.ts`). The polling intervals are code constants.
  - **Provisioning**: the pg-boss queue `alerts.money-received` is created by the worker at start (`boss.createQueue`). The producer of the events is not part of this item (see open questions).
  - **Order and rollback**: apply `005_alerts.sql`, then deploy the API (new routes only), then the worker, then the web app. The worker must not run before the migration or its inserts fail and retry. Rollback: redeploy the previous builds; the leftover table is harmless and can be dropped with `drop table alerts` if desired.
  - Existing-data test: not needed (new table); the migration spec in the tests list pins the unique and ordering indexes.

  ### Shape

  ```mermaid
  flowchart TD
    Q[pg-boss queue alerts.money-received]:::ctx --> W[worker.ts]:::touched
    W --> J[jobs/moneyReceived.ts]:::touched
    J -->|insert on conflict do nothing| T[(alerts table, 005_alerts.sql)]:::touched
    API[alerts.controller / service]:::touched -->|list, count, mark read| T
    API --> SG[SessionGuard]:::ctx
    APP[app.module.ts]:::touched --> API
    LIB[lib/alerts.ts]:::touched -->|/api/alerts via next.config rewrites| API
    PROV[UnreadCountProvider]:::touched --> LIB
    LAY[layout.tsx]:::touched --> PROV
    LAY --> TBC[TopBarControls]:::touched
    TBC --> TB[TopBar]:::touched
    PROV --> TBC
    SCR[AlertsScreen + AlertCard]:::touched --> LIB
    SCR --> PROV
    SCR --> LT[LocalTime, Toast]:::ctx
    classDef touched fill:#f96,color:#000
    classDef ctx fill:#e5e7eb,color:#000
  ```

  worker.ts builds the pool and registers the job; the API owns the schema and the three routes; the provider is the single owner of the polled count so the top bar and the list never disagree after a mark-read.

  ### Design notes (from the prototype that was read)

  Prototype screens used: "Alerts list" (title row with unread badge, list of cards, skeleton, error alert with Try again) and "Alerts list, no alerts" (empty-state with bell icon, "No alerts yet", primary "Back to home"). Unread cards carry a left rule in `--color-primary`, `badge-info` "Unread", amount in `--font-size-lg` semibold, "From: ...", muted time and a `btn-secondary` "Mark as read" (pending text "Marking as read…", toast "Alert marked as read"). Layout is the single centred column of the shell (`.stack .stack-4`, section gaps `--space-4`). Tokens are loaded by the web app's existing globals.css; I did not open the file's import line, so the implementer must name it in the PR.

  The prototype's fixture is oldest-first and reversed for display; the API returns newest first and the screen must not reverse it again.

review_focus: |
  In scope: the worker consumer with once-per-event insert, the alerts table, three API routes, the top bar unread badge polled every 30 seconds, and the alerts list screen with mark-as-read. Out: producing money-received events, other alert types, settings, muting, push, pagination and retention. Riskiest parts are idempotency (unique key plus `on conflict do nothing`, and retries) and per-customer scoping (player id from the session only, `and player_id = $2` on mark-read); also check that failed background polls do not blank the badge. Deliberate: the bell link sits in the top bar (not the prototype's in-content stand-in), the screen does not re-sort the API's newest-first order, and the worker gets its own `pg` pool.
