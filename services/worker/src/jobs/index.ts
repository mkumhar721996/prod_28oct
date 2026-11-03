import type { Pool } from 'pg';
import { createMoneyReceivedJob } from './moneyReceived';

export interface JobDefinition<T = unknown> {
  name: string;
  /** Optional cron expression for scheduled jobs. */
  schedule?: string;
  /** Optional pg-boss queue options (retries). */
  queueOptions?: { retryLimit: number; retryBackoff: boolean };
  /** Optional queue poll interval; pg-boss defaults to 2 seconds. */
  pollingIntervalSeconds?: number;
  handler: (data: T) => Promise<void>;
}

export const NOTIFICATIONS_QUEUE = 'notifications.send';

export async function handleNotification(data: { recipient?: string }): Promise<void> {
  console.log(`notification handled for ${data.recipient ?? 'unknown'}`);
}

export const jobs: JobDefinition<any>[] = [
  { name: NOTIFICATIONS_QUEUE, handler: handleNotification },
];

/** Every job, with those that write to the database bound to `db`. */
export function buildJobs(db: { query: Pool['query'] }): JobDefinition<any>[] {
  return [...jobs, createMoneyReceivedJob(db)];
}
