import type { Pool } from 'pg';

export const TRANSFER_SENT_QUEUE = 'alerts.transfer-sent';

/**
 * Payload of a message on TRANSFER_SENT_QUEUE. A producer sends it with
 * `boss.send(TRANSFER_SENT_QUEUE, event, { singletonKey: event.eventId })`.
 */
export type TransferSentEvent = {
  eventId: string;
  senderPlayerId: string;
  amountMinor: number;
  currency: string;
  recipientName: string;
};

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function assertValid(e: TransferSentEvent): void {
  const ok =
    e &&
    isText(e.eventId) &&
    isText(e.senderPlayerId) &&
    isText(e.currency) &&
    isText(e.recipientName) &&
    Number.isSafeInteger(e.amountMinor) &&
    e.amountMinor >= 1;
  // Throwing lets pg-boss retry or fail the job instead of silently dropping it.
  if (!ok) throw new Error('Invalid transfer-sent event');
}

/** The unique (kind, event_id) index is the dedupe: a redelivered event inserts nothing. */
export async function handleTransferSent(
  data: TransferSentEvent,
  db: Pick<Pool, 'query'>,
): Promise<{ created: boolean }> {
  assertValid(data);
  const { rowCount } = await db.query(
    `insert into alerts (player_id, kind, event_id, amount_minor, currency, recipient_name)
     values ($1, 'transfer_sent', $2, $3, $4, $5)
     on conflict (kind, event_id) do nothing`,
    [data.senderPlayerId, data.eventId, data.amountMinor, data.currency, data.recipientName],
  );
  return { created: rowCount === 1 };
}
