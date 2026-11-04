import type { Pool } from 'pg';

export const IDENTITY_VERIFICATION_RESULT_QUEUE = 'alerts.identity-verification-result';

/**
 * Payload of a message on IDENTITY_VERIFICATION_RESULT_QUEUE. A producer sends it with
 * `boss.send(IDENTITY_VERIFICATION_RESULT_QUEUE, event, { singletonKey: event.eventId })`.
 */
export type IdentityVerificationResultEvent = {
  eventId: string;
  playerId: string;
  result: 'approved' | 'rejected';
};

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function assertValid(e: IdentityVerificationResultEvent): void {
  const ok = e && isText(e.eventId) && isText(e.playerId) && (e.result === 'approved' || e.result === 'rejected');
  // Throwing lets pg-boss retry or fail the job instead of silently dropping it.
  if (!ok) throw new Error('Invalid identity-verification-result event');
}

/** The unique (kind, event_id) index is the dedupe: a redelivered event inserts nothing. */
export async function handleIdentityVerificationResult(
  data: IdentityVerificationResultEvent,
  db: Pick<Pool, 'query'>,
): Promise<{ created: boolean }> {
  assertValid(data);
  const { rowCount } = await db.query(
    `insert into alerts (player_id, kind, event_id, verification_result)
     values ($1, 'identity_verification_result', $2, $3)
     on conflict (kind, event_id) do nothing`,
    [data.playerId, data.eventId, data.result],
  );
  return { created: rowCount === 1 };
}
