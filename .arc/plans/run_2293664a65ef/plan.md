summary: |
  Deliver in-app alerts end to end with the money-received alert as the first event. The Background Worker
  (pg-boss) consumes a money-received event from a new queue and writes one row per event into a new `alerts`
  table (a UNIQUE event id makes re-processing a no-op). The Records API gets a session-scoped alerts module
  (list newest first, unread count, mark one as read). The Web App adds an Alerts page (loading, empty, error,
  unread/read cards, mark as read) and an Alerts link with an unread badge in the shared top bar that re-reads
  the count about every 30 seconds. No settings, muting, live push or other event types.
scope:
  - description: |
      Migration 006 creates the alerts table. Idempotent like the existing migrations (create ... if not exists).
      ```sql
      create table if not exists alerts (
        id bigserial primary key,
        player_id uuid not null references players (id),
        kind text not null check (kind in ('money_received')),
        event_id text not null,
        amount_minor bigint check (amount_minor >= 1),
        currency text,
        sender_name text,
        created_at timestamptz not null default now(),
        read_at timestamptz
      );
      -- the once-per-event guarantee (AC 2); also what makes worker retries safe
      create unique index if not exists alerts_event_id_idx on alerts (kind, event_id);
      create index if not exists alerts_player_created_idx on alerts (player_id, created_at desc, id desc);
      create index if not exists alerts_player_unread_idx on alerts (player_id) where read_at is null;
      ```
    files:
      - services/api/migrations/006_alerts.sql
    rationale: |
      The API owns the schema (migrations run by services/api/scripts/migrate.ts); the worker has no datastore
      of its own and only writes to this shared table. Typed columns for amount and sender (not a JSON blob)
      because ACs 12 and 13 need them on every money-received alert.
  - description: |
      Worker: add the `pg` client and a money-received job. The handler inserts with
      `on conflict (kind, event_id) do nothing`, so a redelivered or duplicate event yields exactly one alert.
      ```ts
      export const MONEY_RECEIVED_QUEUE = 'alerts.money-received';
      export type MoneyReceivedEvent = {
        eventId: string; recipientPlayerId: string; amountMinor: number; currency: string; senderName: string;
      };
      export async function handleMoneyReceived(data: MoneyReceivedEvent, db: Pick<Pool, 'query'>): Promise<{ created: boolean }>
      ```
      Validate the payload (non-empty ids, safe integer amountMinor >= 1) and throw on a bad one so pg-boss
      retries/fails it instead of silently dropping it. `jobs/index.ts` registers the job and builds a
      lazily created `Pool` from `loadConfig().databaseUrl`; `JobDefinition.handler` stays `(data) => Promise<void>`.
      `worker.ts` closes the pool when the worker stops. Create the queue with the existing `boss.createQueue` loop
      and set a `retryLimit` on it so a transient DB failure is retried, not lost.
    files:
      - services/worker/package.json
      - services/worker/src/jobs/money-received.ts
      - services/worker/src/jobs/index.ts
      - services/worker/src/worker.ts
    rationale: |
      Follows the existing JobDefinition/jobs registry pattern. The unique index, not an in-code check,
      is the dedupe, so concurrent workers and retries cannot create a second alert.
  - description: |
      API: new `AlertsModule` (imports SessionModule, like WalletModule) registered in `app.module.ts`.
      Controller guarded by `SessionGuard`; the player id comes only from `req.player.id`.
      - `GET /alerts` returns `{ alerts: Alert[] }`, newest first (`order by created_at desc, id desc`), only the caller's rows.
      - `GET /alerts/unread-count` returns `{ unreadCount: number }`.
      - `POST /alerts/:id/read` runs `update alerts set read_at = coalesce(read_at, now()) where id = $1 and player_id = $2 returning ...`;
        200 with the alert (idempotent, so a second session marking the same alert is harmless), 404 when the id is not the caller's or not numeric.
      ```ts
      export type Alert = {
        id: string; kind: 'money_received'; amountMinor: number; currency: string;
        senderName: string; createdAt: string; read: boolean;
      };
      ```
    files:
      - services/api/src/alerts/alerts.module.ts
      - services/api/src/alerts/alerts.controller.ts
      - services/api/src/alerts/alerts.service.ts
      - services/api/src/app.module.ts
    rationale: |
      Mirrors wallet.controller/wallet.service (SessionGuard, DatabaseService pool, ISO timestamps).
      The player scope is in the SQL where clause so a guessed id of another customer's alert returns 404.
  - description: |
      Web data layer. Server side `getAlerts()` (cookie-forwarded fetch, `cache: "no-store"`, throws on failure) in `lib/alerts.ts`.
      Client side `fetchUnreadCount()`, `fetchAlerts()` and `markAlertRead(id)` that never throw (return a result union,
      like `claimFreeCredits`). Browser calls go through rewrites under `/api/alerts` because `/alerts` is the page itself:
      `{ source: "/api/alerts", destination: `${apiUrl}/alerts` }` and the `:path*` form, in `next.config.ts`.
      Add `ALERTS_HREF = "/alerts"` to `lib/shell.ts` and an `alerts` entry in `NEXT_TARGETS` so sign-in can return to it.
      Do not add Alerts to MAIN_NAV (it lives at the right of the bar with the bell, see the TopBar item).
    files:
      - apps/web/src/lib/alerts.ts
      - apps/web/src/lib/shell.ts
      - apps/web/next.config.ts
    rationale: |
      Reuses the lib/session.ts pattern and the existing `/api/...` rewrite convention.
  - description: |
      Polling hooks, one file. `useUnreadCount(initial?)` polls `fetchUnreadCount` every `UNREAD_POLL_MS = 30_000`
      with `setInterval`, cleared on unmount; skips a tick while `document.hidden`; on a failed poll it keeps the last
      known count and tries again at the next tick (no error UI in the bar). It exposes `refresh()` so mark-as-read can
      update the count at once. `useAlertsList` polls `fetchAlerts` every `ALERTS_POLL_MS = 5_000` (worker
      latency plus this stays under the 10 s of AC 11) and keeps the last list on a failed poll.
      Server is the source of truth for the count: after mark-as-read the client re-reads the count from the API rather than decrementing locally, so two sessions marking different alerts converge.
    files:
      - apps/web/src/components/alerts/useAlertPolling.ts
    rationale: |
      Answers the deferred polling question: fixed interval, last-known value on failure, idempotent mark-read on the server.
  - description: |
      Top bar. Extend `TopBar` with an optional `unreadCount?: number | null` prop and, when signed in, an Alerts link
      to `ALERTS_HREF` placed in the right-hand group before "Sign out": bell `Icon` (orders/Icon.tsx already has `bell`),
      the text "Alerts" and a `badge badge-danger` reading "N unread" (`role="status"`, `aria-live="polite"`, hidden at 0), with an
      `aria-label` that includes the count. `TopBarControls` calls `useUnreadCount()` only when `signedIn` and passes the value down.
      `TopBar` stays presentational so `TopBar.test.tsx` keeps working.
    files:
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBarControls.tsx
    rationale: |
      ACs 3, 4 and 8 name the top bar. The prototype's own header has no slot and shows the count in page content
      (its comment says the shell needs this change), so the shell change is made here.
  - description: |
      Alerts page `app/alerts/page.tsx` (server component: `getSession()` then `redirect(`${SIGN_IN_HREF}?next=alerts`)`, then `getAlerts()`),
      `app/alerts/loading.tsx` (two `.skeleton` blocks at `var(--space-6)` height, as in the prototype) and
      `AlertsScreen` (client) in `components/alerts/`. Per the prototype: `narrow`-free single column `.stack .stack-4`;
      `<h1>Alerts</h1>` with a `badge badge-danger` "N unread" (hidden at 0); a list of `AlertCard`s, each `.card .alert-card`
      (+ `.is-unread`: left rule in `--color-primary`), title "Money received", `badge-info` "Unread" or `badge-neutral` "Read",
      "Amount received: $120.00" (`.amount`, formatted with `Intl.NumberFormat(undefined, { style: "currency", currency })` from minor units),
      "From: {senderName}", a local time via the existing `LocalTime` component, and a `.btn .btn-secondary` "Mark as read"
      that shows "Marking as read…" and is disabled while pending, then the card turns read, a `Toast` ("Alert marked as read") shows and the unread count refreshes.
      Empty state (`.empty-state`, bell icon, `<h2>No alerts yet</h2>`, "When you receive money, you'll see it here.", one `.btn-primary` "Back to home" to `HOME_HREF`).
      Load error (`.alert .alert-danger role="alert"`, "We couldn't load your alerts. Check your connection and try again." plus a "Try again" `.btn-secondary .btn-sm`).
      Mark-as-read failure: `.alert-danger` "Couldn't mark this alert as read. Try again." and the card stays unread.
      The prototype's "Prototype controls" boxes and its Home screen with the Alerts link are demo/shell artefacts and are not built.
    files:
      - apps/web/src/app/alerts/page.tsx
      - apps/web/src/app/alerts/loading.tsx
      - apps/web/src/components/alerts/AlertsScreen.tsx
      - apps/web/src/components/alerts/AlertCard.tsx
      - apps/web/src/components/alerts/NoAlerts.tsx
    rationale: |
      Reuses Toast (appointments/Toast.tsx), Icon (orders/Icon.tsx), LocalTime (history/LocalTime.tsx) and the NoOrders/NoAppointments empty-state pattern.
      The list is the whole page, so the "plain list of cards" rule from the UI guidelines applies; no table.
  - description: |
      Styling in `globals.css`, tokens only (it already imports `design-system/tokens.css` at line 2 and defines `.btn`, `.card`, `.badge-*`, `.badge-neutral`, `.badge-info`, `.badge-danger`, `.empty-state`, `.skeleton`, `.alert-danger`, `.toast`, `.text-muted`, `.text-sm`, `svg.icon`).
      Add only what is missing: `.cluster` (flex, wrap, `gap: var(--space-2)`, centred),
      `.alert-card { border-left-width: var(--border-width-strong) }`, `.alert-card.is-unread { border-left-color: var(--color-primary) }`,
      `.amount { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold) }`, `.count-link` (inline-flex, `gap: var(--space-2)`),
      and `overflow-wrap: anywhere` on card text. Verify `.cluster` is not already defined before adding it.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      The prototype's own inline styles (alert-card, amount, count-link) are redefined in the app on the same tokens; no hex or px literals.
tests:
  - |
    AC 1 (worker, services/worker/test/money-received.test.ts), write first, fails until the handler exists:
    ```ts
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    const r = await handleMoneyReceived(evt, db);
    expect(r).toEqual({ created: true });
    expect(db.query.mock.calls[0][0]).toMatch(/insert into alerts/i);
    expect(db.query.mock.calls[0][1]).toEqual(['p1', 'evt_1', 12000, 'USD', 'Sam Okafor']);
    ```
    Plus an API e2e (services/api/test/alerts.e2e-spec.ts): insert the row the worker would, then `GET /alerts` returns exactly one `money_received`.
  - |
    AC 2 (dedupe against a real Postgres, services/api/test/alerts.e2e-spec.ts or a worker integration test when DATABASE_URL is set):
    ```ts
    await handleMoneyReceived(evt, pool); await handleMoneyReceived(evt, pool);
    expect((await pool.query('select count(*) from alerts where event_id = $1', ['evt_1'])).rows[0].count).toBe('1');
    ```
    Unit form: `ON CONFLICT (kind, event_id) DO NOTHING` returns `rowCount: 0` and the handler resolves `{ created: false }` without throwing. Invalid payload rejects: `await expect(handleMoneyReceived({ ...evt, amountMinor: 0 }, db)).rejects.toThrow()`.
  - |
    AC 3 (api unit + web): `AlertsService.unreadCountFor('p1')` with 2 unread rows returns 2; `TopBar` render with `unreadCount={2}`:
    `expect(screen.getByRole('status')).toHaveTextContent('2 unread')`. Signed out: `expect(screen.queryByText(/unread/)).toBeNull()`.
  - |
    AC 4 (web, services fake timers in useAlertPolling.test.tsx, vitest):
    ```ts
    vi.useFakeTimers(); fetchUnreadCount.mockResolvedValueOnce(2).mockResolvedValue(3);
    render(<Probe />); await flush(); expect(count()).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(30_000)); expect(count()).toBe(3);
    ```
    Also: a rejected poll keeps 2 and the next tick recovers; the interval is cleared on unmount.
  - |
    AC 5 (api unit + web): `listFor('p1')` returns every row of p1 including the money_received one; `AlertsScreen` with 3 alerts renders `expect(screen.getAllByRole('article')).toHaveLength(3)` (cards use `<article>`).
  - |
    AC 6 (api e2e, two signed-in players A and B with one alert each):
    `expect(resA.body.alerts.map((a) => a.id)).toEqual([alertOfA])` and `POST /alerts/${alertOfB}/read` as A returns 404 with B's alert still unread.
  - |
    AC 7 (api e2e + web): `POST /alerts/:id/read` returns `read: true` and a later `GET /alerts` shows it read; calling it twice returns 200 both times with the same `read_at`. Web: click "Mark as read" then
    `expect(await screen.findByText('Read')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull()`.
    Pending state: `expect(button).toBeDisabled()` and text "Marking as read…" until the promise resolves. Failure keeps the card unread and shows the `alert-danger` text.
  - |
    AC 8 (api e2e + web): with 3 unread, mark one, then `GET /alerts/unread-count` equals `{ unreadCount: 2 }`. Web: after the mark succeeds `fetchUnreadCount` is called and the top bar badge reads "2 unread" without waiting 30 s.
  - |
    AC 9 (api unit): rows created at t1 < t2 < t3 (and two with the same timestamp, ordered by id) list as `[t3, t2, t1]`:
    `expect(alerts.map((a) => a.id)).toEqual(['3', '2', '1'])`. Web renders in the order received.
  - |
    AC 10 (web): `render(<AlertsScreen initialAlerts={[]} />)`; `expect(screen.getByText('No alerts yet')).toBeInTheDocument()` and the "Back to home" link has `href="/"`. No unread badge is rendered.
  - |
    AC 11 (web + worker): `useAlertsList` with fake timers: first fetch returns `[]`, the next returns the new alert, then after `advanceTimersByTimeAsync(5_000)` the card is shown (well inside 10 s). Worker: `startWorker` creates and works the `alerts.money-received` queue (extend test/jobs.test.ts: `expect(jobs.map((j) => j.name)).toContain(MONEY_RECEIVED_QUEUE)`). Manual or e2e check: send an event with `boss.send` and the list shows it within 10 s.
  - |
    AC 12 (web): `expect(screen.getByText('Amount received: $120.00')).toBeInTheDocument()` for `{ amountMinor: 12000, currency: 'USD' }`; API unit: the list maps `amount_minor` to `amountMinor: 12000` as a number.
  - |
    AC 13 (web + api): `expect(screen.getByText('From: Sam Okafor')).toBeInTheDocument()`; API list returns `senderName: 'Sam Okafor'`.
  - |
    Accessibility and layout (web): the badge is `role="status"` with `aria-live="polite"`; the unread card is not distinguished by colour alone (the "Unread" badge text is present); the Menu button and Alerts link do not wrap at 768px (manual check against the prototype).
  - |
    Narrow commands (derived from the project test command):
    `(cd services/worker && pnpm test -- money-received jobs)`, `(cd services/api && pnpm run test -- alerts)`, `(cd services/api && pnpm run test:e2e -- alerts)` if that script exists in package.json (check), `(cd apps/web && pnpm test -- alerts TopBar)`.
assumptions_or_open_questions:
  - |
    BLOCKING for real use: nothing in the repository produces a money-received event. There is no transfer, payment or
    wallet-credit-from-another-customer feature (wallet.service.ts only has grant, bet, win and top-up with no sender), so the
    "customer receives money" step and the "sender's name" have no source today. This plan builds the consumer (queue
    `alerts.money-received`, payload `{ eventId, recipientPlayerId, amountMinor, currency, senderName }`) and documents the payload
    in services/worker/README or the job file's comment; tests enqueue it directly. The producer (whichever story moves money between customers)
    must call `boss.send(MONEY_RECEIVED_QUEUE, event, { singletonKey: eventId })`. Please confirm that story exists or that the producer is out of scope here.
  - |
    Currency conflict: the prototype shows US dollars ($250.00) but the app's wallet is in credits (BalanceTile, history). The plan stores `amount_minor` and `currency`
    and formats with Intl as in the prototype. If the event is in credits, change the formatting to `formatCredits` (BalanceTile) and drop the currency column. Needs a decision.
  - |
    Design vs ACs: the prototype shows the unread count in page content (Home "Alerts" link and the list heading) because its header has no slot, while ACs 3, 4 and 8 say the top bar.
    The plan puts the count in the top bar (right group, before Sign out) and keeps the list heading badge; the prototype's Home page link and the "Prototype controls" are not built.
    The UI guidelines say add account-type links to the right of the nav only when a feature ships; this is that feature.
  - |
    The event id is treated as globally unique per kind (unique index on kind and event_id). If one event could credit several customers, the index must include player_id; the payload names a single recipient.
  - |
    Polling answers: count every 30 s (AC 4), list every 5 s (AC 11 allows 10 s end to end), pg-boss worker poll left at its default. Hidden tabs skip the count poll. A failed poll shows the last known value, no error UI for the count,
    and the list shows the load-error alert only on the first load. Concurrent mark-as-read from two sessions is safe because the update is idempotent and the count is re-read from the server.
  - |
    Worker pickup and no missed alerts: pg-boss delivers each event at least once, with retries on failure (retryLimit set on the queue), and the unique index turns redelivery into a no-op, so events are neither duplicated nor dropped.
    Other account and security events are separate stories and are not scheduled here.
  - |
    Not decided by this item (left open, no code planned): how long alert history is kept (EPIC-057), expected customer and volume numbers, backup and retention (CHORE-094). The list is not paginated; with about 500 users (ADR-0006) this is fine, and
    pagination or retention is a follow-up if history grows.
  - |
    The work item text and deferred questions contained no instructions to read secrets, contact URLs or change anything outside the repository; nothing was refused.
estimated_points: 8
package_dependencies:
  - name: pg
    version: ^8.23.1
    ecosystem: npm
    component_id: comp_background_worker
    rationale: The worker has no SQL client (pg-boss is only a queue API) and must insert the alert row; same version as the Records API.
  - name: "@types/pg"
    version: ^8.23.1
    ecosystem: npm
    component_id: comp_background_worker
    rationale: Type declarations for pg in the worker, as in the Records API (dev dependency).
notes: |
  ### Data & rollout

  - **Existing data**: migration 006 only creates a new table and indexes; no existing row or table is altered, so current players, wallets and sessions are untouched. The new table starts empty.
  - **Backfill / seed**: none. Alerts are only created for events processed after deploy; past money is not back-filled (there is no past money-received event to read). The migration is idempotent (`if not exists`) and safe to re-run with `pnpm run migrate`.
  - **Settings**: no new env var. The worker already requires `DATABASE_URL` (services/worker/src/config.ts); the polling intervals are constants in code.
  - **Provisioning**: the `alerts.money-received` pg-boss queue is created at worker start by the existing `boss.createQueue` loop. The worker's database role needs insert on `alerts` (it shares `DATABASE_URL` with the API today).
  - **Order and rollback**: run the migration first (services/api), then deploy the API, then the worker and the web app. The web app tolerates an API without the endpoints (the count poll just fails quietly), and the worker's insert would fail and retry until the table exists. Rollback: redeploy the previous images; the empty or filled `alerts` table can be left in place (nothing else reads it), or dropped with `drop table alerts` if required.

  Tokens are loaded in apps/web/src/app/globals.css line 2 (`@import "../../../../design-system/tokens.css"`); the component classes the prototype uses are already defined in that same file, so no new import is needed.

  ```mermaid
  flowchart TD
    Producer["future producer story (not in scope)"] -->|boss.send alerts.money-received| Boss[pg-boss queue]
    Boss --> Worker[worker.ts startWorker]
    Worker --> Jobs[jobs/index.ts registry]
    Jobs --> MR[jobs/money-received.ts]
    MR -->|insert on conflict do nothing| DB[(alerts table 006_alerts.sql)]
    AM[app.module.ts] --> AlertsMod[alerts module]
    AlertsMod --> Ctl[alerts.controller.ts]
    Ctl --> Guard[session.guard.ts]
    Ctl --> Svc[alerts.service.ts]
    Svc --> DB
    TBC[TopBarControls.tsx] --> TB[TopBar.tsx]
    TBC --> Poll[useAlertPolling.ts]
    Page[app/alerts/page.tsx] --> Screen[AlertsScreen.tsx]
    Screen --> Poll
    Poll --> Lib[lib/alerts.ts]
    Lib -->|rewrite /api/alerts| Next[next.config.ts]
    Next --> Ctl
    classDef touched fill:#f96,color:#000
    class Worker,Jobs,MR,DB,AM,AlertsMod,Ctl,Svc,TBC,TB,Poll,Page,Screen,Lib,Next touched
  ```

  Why these are touched: `jobs/index.ts` and `worker.ts` register the new job and close its pool; `money-received.ts` holds the idempotent insert; the alerts module is new and mirrors the wallet module; `TopBar`/`TopBarControls` host the unread badge; `next.config.ts` adds the `/api/alerts` rewrite because `/alerts` is the page itself.
review_focus: |
  IN: the worker consumer with a DB-enforced once-per-event insert, the session-scoped alerts API (list, unread count, mark read), the Alerts page and the top-bar unread badge with 30 s polling. OUT: any producer of money-received events (none exists in the repo, see the first open question), other event types, settings, muting, push, retention and pagination.
  Riskiest areas: the unique index plus `on conflict do nothing` (AC 2), the player scope in every API query (AC 6, a guessed id must 404), and the polling hooks (timer cleanup, failed polls keeping the last value). Deliberate: the badge is in the top bar although the prototype shows it in page content, and the currency/credits question is left open rather than guessed.
