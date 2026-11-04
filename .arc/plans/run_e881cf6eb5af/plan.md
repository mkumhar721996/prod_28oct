summary: |
  Extend the money-received alert slice with four more worker-created alert kinds: transfer sent, account frozen, account unfrozen and identity verification result. Each gets its own pg-boss queue and handler that inserts into the existing `alerts` table, deduped by the existing unique `(kind, event_id)` index. A new migration widens the `kind` check and adds the few detail columns the new kinds need. The Records API list view and the web `Alert` type / `AlertCard` learn the new kinds. The unread count, polling and mark-read paths already count every row, so they work unchanged (AC 6, 7, 8).
scope:
  - description: |
      Migration `007_alerts_more_kinds.sql`. Drop the `alerts_kind_check` constraint and re-add it with the five kinds
      (`money_received`, `transfer_sent`, `account_frozen`, `account_unfrozen`, `identity_verification_result`).
      Add nullable `recipient_name text` and `verification_result text check (verification_result in ('approved','rejected'))`.
      Reuse `amount_minor`, `currency` for the transfer amount. `sender_name` stays money-received only.
      Use `drop constraint if exists` and `add column if not exists` so it is safe to re-run.
    files:
      - services/api/migrations/007_alerts_more_kinds.sql
    rationale: |
      The current check allows only 'money_received', so inserts for new kinds would fail. The unique (kind, event_id) index already gives per-kind dedupe (AC 5).
  - description: |
      Worker handlers, one file per kind, mirroring `money-received.ts` (exported queue name, event type, validation that throws, `insert ... on conflict (kind, event_id) do nothing`, returns `{ created: boolean }`).
      Queues: `alerts.transfer-sent`, `alerts.account-frozen`, `alerts.account-unfrozen`, `alerts.identity-verification-result`.
      ```ts
      export type TransferSentEvent = { eventId: string; senderPlayerId: string; amountMinor: number; currency: string; recipientName: string };
      export type AccountStatusEvent = { eventId: string; playerId: string };            // frozen and unfrozen
      export type IdentityVerificationResultEvent = { eventId: string; playerId: string; result: 'approved' | 'rejected' };
      export async function handleTransferSent(data: TransferSentEvent, db: Pick<Pool, 'query'>): Promise<{ created: boolean }>
      ```
    files:
      - services/worker/src/jobs/transfer-sent.ts
      - services/worker/src/jobs/account-status.ts
      - services/worker/src/jobs/identity-verification-result.ts
    rationale: |
      Redelivery and retries are safe because the insert is idempotent. Invalid payloads throw so pg-boss retries or fails the job instead of dropping it.
  - description: |
      Register the four queues in `jobs` with `retryLimit: 5`, like money-received, using the shared lazy `db()` pool.
      The producers' `boss.send(queue, event, { singletonKey: event.eventId })` convention is documented in each event type's comment.
    files:
      - services/worker/src/jobs/index.ts
    rationale: |
      `worker.ts` creates and works every entry in `jobs`, so registering is all pg-boss needs. The 10 second criterion (AC 8) is met by pg-boss polling plus the web list's 5s poll (`ALERTS_POLL_MS`).
  - description: |
      Records API: widen the `Alert` view and `Row` types to a union of kinds. Add `recipientName?` and `verificationResult?`.
      `amountMinor`, `currency` and `senderName` become optional or null for kinds that lack them. Fix `view()` so a null `amount_minor` is not turned into 0 by `Number(null)`.
      Add the new columns to `COLUMNS`.
    files:
      - services/api/src/alerts/alerts.service.ts
    rationale: |
      The list and unread-count queries are kind-agnostic and already satisfy AC 6 and 7. Only the row-to-view mapping needs to change.
  - description: |
      Web: widen `Alert` in `lib/alerts.ts` to match the API shape. `AlertCard` renders by `kind`:
      "Money sent" (amount, recipient), "Account frozen", "Account unfrozen", and the identity verification alert with distinct wording per result
      ("Identity verified" vs "Identity verification unsuccessful") for AC 9. It keeps the existing card, badge, button, `LocalTime` and unread styling, so no new tokens or classes are introduced.
    files:
      - apps/web/src/lib/alerts.ts
      - apps/web/src/components/alerts/AlertCard.tsx
    rationale: |
      Reuses the existing `AlertCard` and its design-system classes (`card`, `alert-card`, `badge`, `btn`), so the UI step needs no new styling. `AlertsScreen`, `TopBar` and `TopBarControls` are untouched.
tests:
  - |
    AC1 (services/worker/test/transfer-sent.test.ts, written first). Handler inserts one transfer_sent alert.
    ```ts
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    await expect(handleTransferSent(evt, db)).resolves.toEqual({ created: true });
    expect(db.query.mock.calls[0][0]).toMatch(/insert into alerts/i);
    expect(db.query.mock.calls[0][1]).toContain('evt_t1');
    ```
  - |
    AC2 (services/worker/test/account-status.test.ts). Frozen event inserts one account_frozen alert.
    ```ts
    await expect(handleAccountFrozen({ eventId: 'evt_f1', playerId: 'p1' }, db)).resolves.toEqual({ created: true });
    expect(db.query.mock.calls[0][0]).toMatch(/'account_frozen'/);
    ```
  - |
    AC3 (same file). Unfrozen event inserts one account_unfrozen alert.
    ```ts
    expect(db.query.mock.calls[0][0]).toMatch(/'account_unfrozen'/);
    ```
  - |
    AC4 (services/worker/test/identity-verification-result.test.ts). Inserts one identity_verification_result alert carrying the result. A result other than approved or rejected is rejected without querying.
    ```ts
    expect(db.query.mock.calls[0][1]).toContain('approved');
    await expect(handleIdentityVerificationResult({ ...evt, result: 'maybe' as never }, db)).rejects.toThrow();
    ```
  - |
    AC5, for each of the four handlers. A duplicate delivery is a no-op, and the migration keeps the unique index.
    ```ts
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
    await expect(handleTransferSent(evt, db)).resolves.toEqual({ created: false });
    expect(db.query.mock.calls[0][0]).toMatch(/on conflict \(kind, event_id\) do nothing/i);
    ```
    Also add a migration test in the style of money-received.test.ts. It reads 007_alerts_more_kinds.sql and asserts it lists all five kinds, plus `alerts_event_id_idx` in 006 is unchanged. It also asserts that 007 does not drop or alter existing rows, so money_received rows stay readable (existing-rows check).
  - |
    AC6 and AC7 (services/api/src/alerts/alerts.service.spec.ts). Rows of the new kinds are mapped with `read: false` when `read_at` is null, and `unreadCountFor` counts all kinds, because the SQL has no kind filter.
    ```ts
    expect(query.mock.calls[0][0]).not.toContain('kind');   // unreadCountFor
    expect(alerts[0]).toMatchObject({ kind: 'account_frozen', read: false });
    expect(alerts[0].amountMinor).toBeUndefined();          // null amount is not mapped to 0
    ```
    In apps/web/src/components/alerts/AlertCard.test.tsx, each new kind renders `is-unread` and an Unread badge when `read` is false.
  - |
    AC8 (services/worker/test/transfer-sent.test.ts and the other three). Each queue is registered with retries so a transient failure does not delay or lose the alert.
    ```ts
    expect(jobs.find((j) => j.name === TRANSFER_SENT_QUEUE)?.retryLimit).toBeGreaterThan(0);
    ```
    The display side is already covered by the existing `ALERTS_POLL_MS` (5s) test in apps/web/src/lib/alerts.test.ts. Keep that assertion and add `expect(ALERTS_POLL_MS).toBeLessThan(10_000)` if it is not there.
  - |
    AC9 (apps/web/src/components/alerts/AlertCard.test.tsx). Two verification alerts with different results render different wording.
    ```ts
    const ok = render({ ...base, kind: "identity_verification_result", verificationResult: "approved" });
    const bad = render({ ...base, kind: "identity_verification_result", verificationResult: "rejected" });
    expect(ok).not.toEqual(bad);
    expect(ok).toContain("Identity verified");
    expect(bad).toContain("Identity verification unsuccessful");
    ```
assumptions_or_open_questions:
  - |
    How the worker picks up events (the deferred question). Decided from the existing pattern. Each event kind has its own pg-boss queue. An upstream producer calls `boss.send(queue, event, { singletonKey: event.eventId })`. The handler's idempotent insert on the unique (kind, event_id) index prevents duplicates, and `retryLimit: 5` with backoff prevents misses. No producer for these four events exists in the repo (I searched for freeze, frozen and identity and found none outside a back-office placeholder string). Producing the events is out of scope for this story, as it was for money-received. A human should confirm that the freeze, verification and transfer features will emit the events with the payloads above.
  - |
    The event payload field names (senderPlayerId, recipientName, result values approved and rejected) are my assumptions. The item does not specify them. Confirm them with whoever owns the producers.
  - |
    Wording for the new alerts is not specified beyond AC9 (the two results must differ). I assume "Money sent", "Account frozen", "Account unfrozen", "Identity verified" and "Identity verification unsuccessful".
  - |
    The `NoAlerts` empty-state copy says "When you receive money, you'll see it here." It stays as is. A human may want it broadened.
  - |
    Alert retention (how long alert history is kept) and the project-wide scale, backup and record-retention questions are not answered by this story. No pruning is planned, and the alerts table grows unbounded, as today.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: Migration 007 only relaxes the `kind` check (a superset of the old one) and adds nullable columns, so existing `money_received` rows stay valid and readable with no rewrite.
  - **Backfill / seed**: None needed. The migration is idempotent (`drop constraint if exists`, `add column if not exists`). Re-adding the check constraint scans the table once, which is cheap at ~500 users (ADR-0006).
  - **Settings**: No new settings or env vars.
  - **Provisioning**: The four queues are created by `worker.ts` at startup (`boss.createQueue`). Nothing else is needed beforehand.
  - **Order and rollback**: Run migration 007 before deploying the worker, because the handlers insert the new kinds. Deploy the API and web after, because they must tolerate new kinds. Rollback means redeploying the old code. The migration is safe to leave in place. A down migration would have to delete the new-kind rows before restoring the old check, so it is not planned.

  The existing money-received migration is 006, and the next free number is 007 (checked in services/api/migrations).

  ```mermaid
  flowchart TD
    W[worker.ts] --> J[jobs/index.ts]
    J --> M[money-received.ts]
    J --> T[transfer-sent.ts]
    J --> A[account-status.ts]
    J --> I[identity-verification-result.ts]
    T --> DB[(alerts table, migration 007)]
    A --> DB
    I --> DB
    DB --> S[alerts.service.ts]
    S --> L[web lib/alerts.ts]
    L --> C[AlertCard.tsx]
    classDef touched fill:#f96,color:#000
    class J,T,A,I,DB,S,L,C touched
  ```
  Touched nodes: `jobs/index.ts` registers the queues, the three handler files are new, migration 007 widens the table, `alerts.service.ts` maps the new columns, and `lib/alerts.ts` and `AlertCard.tsx` render the new kinds.

  UI: `AlertCard` is extended in place, so no new component or design token is needed.
review_focus: |
  In scope: four worker handlers and queues, migration 007, the API view mapping, and web `Alert` / `AlertCard` rendering. Out of scope: producing the events (no producer exists in the repo), email or SMS, retention and pruning. Riskiest points are the check-constraint swap in migration 007 and keeping null amounts from becoming 0 in `view()`. The event payload shapes and the alert wording are assumptions to confirm.
