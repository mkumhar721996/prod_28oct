import type { Pool } from 'pg';

export const MONEY_RECEIVED_QUEUE = 'alerts.money-received';

/**
 * Payload of a message on MONEY_RECEIVED_QUEUE. A producer sends it with
 * `boss.send(MONEY_RECEIVED_QUEUE, event, { singletonKey: event.eventId })`.
 */
export type MoneyReceivedEvent = {
  eventId: string;
  recipientPlayerId: string;
  amountMinor: number;
  currency: string;
  senderName: string;
};

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function assertValid(e: MoneyReceivedEvent): void {
  const ok =
    e &&
    isText(e.eventId) &&
    isText(e.recipientPlayerId) &&
    isText(e.currency) &&
    isText(e.senderName) &&
    Number.isSafeInteger(e.amountMinor) &&
    e.amountMinor >= 1;
  // Throwing lets pg-boss retry or fail the job instead of silently dropping it.
  if (!ok) throw new Error('Invalid money-received event');
}

/** The unique (kind, event_id) index is the dedupe: a redelivered event inserts nothing. */
export async function handleMoneyReceived(
  data: MoneyReceivedEvent,
  db: Pick<Pool, 'query'>,
): Promise<{ created: boolean }> {
  assertValid(data);
  const { rowCount } = await db.query(
    `insert into alerts (player_id, kind, event_id, amount_minor, currency, sender_name)
     values ($1, 'money_received', $2, $3, $4, $5)
     on conflict (kind, event_id) do nothing`,
    [data.recipientPlayerId, data.eventId, data.amountMinor, data.currency, data.senderName],
  );
  return { created: rowCount === 1 };
}
