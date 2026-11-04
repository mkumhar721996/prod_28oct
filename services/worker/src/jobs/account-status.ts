import type { Pool } from 'pg';

export const ACCOUNT_FROZEN_QUEUE = 'alerts.account-frozen';
export const ACCOUNT_UNFROZEN_QUEUE = 'alerts.account-unfrozen';

/**
 * Payload of a message on ACCOUNT_FROZEN_QUEUE or ACCOUNT_UNFROZEN_QUEUE. A producer sends it with
 * `boss.send(queue, event, { singletonKey: event.eventId })`.
 */
export type AccountStatusEvent = { eventId: string; playerId: string };

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** The unique (kind, event_id) index is the dedupe: a redelivered event inserts nothing. */
async function insertStatusAlert(
  kind: 'account_frozen' | 'account_unfrozen',
  data: AccountStatusEvent,
  db: Pick<Pool, 'query'>,
): Promise<{ created: boolean }> {
  // Throwing lets pg-boss retry or fail the job instead of silently dropping it.
  if (!data || !isText(data.eventId) || !isText(data.playerId)) {
    throw new Error(`Invalid ${kind} event`);
  }
  const { rowCount } = await db.query(
    `insert into alerts (player_id, kind, event_id)
     values ($1, '${kind}', $2)
     on conflict (kind, event_id) do nothing`,
    [data.playerId, data.eventId],
  );
  return { created: rowCount === 1 };
}

export const handleAccountFrozen = (data: AccountStatusEvent, db: Pick<Pool, 'query'>) =>
  insertStatusAlert('account_frozen', data, db);

export const handleAccountUnfrozen = (data: AccountStatusEvent, db: Pick<Pool, 'query'>) =>
  insertStatusAlert('account_unfrozen', data, db);
