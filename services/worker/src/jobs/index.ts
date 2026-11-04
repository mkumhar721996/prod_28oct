import { Pool } from 'pg';
import { loadConfig } from '../config';
import { MONEY_RECEIVED_QUEUE, MoneyReceivedEvent, handleMoneyReceived } from './money-received';

export interface JobDefinition<T = unknown> {
  name: string;
  /** Optional cron expression for scheduled jobs. */
  schedule?: string;
  /** Optional pg-boss retry limit for the queue, so a transient failure is retried, not lost. */
  retryLimit?: number;
  handler: (data: T) => Promise<void>;
}

export const NOTIFICATIONS_QUEUE = 'notifications.send';

export async function handleNotification(data: { recipient?: string }): Promise<void> {
  console.log(`notification handled for ${data.recipient ?? 'unknown'}`);
}

let pool: Pool | undefined;

/** Created on first use, so importing the registry never opens a connection. */
function db(): Pool {
  pool ??= new Pool({ connectionString: loadConfig().databaseUrl });
  return pool;
}

export async function closeJobResources(): Promise<void> {
  const open = pool;
  pool = undefined;
  await open?.end();
}

export const jobs: JobDefinition<any>[] = [
  { name: NOTIFICATIONS_QUEUE, handler: handleNotification },
  {
    name: MONEY_RECEIVED_QUEUE,
    retryLimit: 5,
    handler: async (data: MoneyReceivedEvent) => {
      await handleMoneyReceived(data, db());
    },
  },
];
