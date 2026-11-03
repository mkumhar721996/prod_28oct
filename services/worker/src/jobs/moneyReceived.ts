import type { Pool } from 'pg';
import type { JobDefinition } from './index';

export const MONEY_RECEIVED_QUEUE = 'alerts.money-received';

export type MoneyReceivedEvent = {
  eventId: string;
  recipientId: string;
  senderName: string;
  amountMinor: number;
  currency: string;
};

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function assertValid(e: MoneyReceivedEvent): void {
  const ok =
    e &&
    isText(e.eventId) &&
    isText(e.recipientId) &&
    isText(e.senderName) &&
    isText(e.currency) &&
    Number.isInteger(e.amountMinor) &&
    e.amountMinor > 0;
  // Throwing lets pg-boss retry or fail the job instead of silently dropping it.
  if (!ok) throw new Error('Invalid money-received event');
}

/** One alert per (recipient, event): the unique key makes a replay or retry a no-op. */
export function createMoneyReceivedJob(db: { query: Pool['query'] }): JobDefinition<MoneyReceivedEvent> {
  return {
    name: MONEY_RECEIVED_QUEUE,
    queueOptions: { retryLimit: 5, retryBackoff: true },
    pollingIntervalSeconds: 1,
    handler: async (event) => {
      assertValid(event);
      const { eventId, recipientId, senderName, amountMinor, currency } = event;
      await db.query(
        `insert into alerts (player_id, kind, event_id, amount_minor, currency, sender_name)
         values ($1, 'money_received', $2, $3, $4, $5)
         on conflict (player_id, kind, event_id) do nothing`,
        [recipientId, eventId, amountMinor, currency, senderName],
      );
    },
  };
}
