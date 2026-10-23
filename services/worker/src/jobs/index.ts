export interface JobDefinition<T = unknown> {
  name: string;
  /** Optional cron expression for scheduled jobs. */
  schedule?: string;
  handler: (data: T) => Promise<void>;
}

export const NOTIFICATIONS_QUEUE = 'notifications.send';

export async function handleNotification(data: { recipient?: string }): Promise<void> {
  console.log(`notification handled for ${data.recipient ?? 'unknown'}`);
}

export const jobs: JobDefinition<any>[] = [
  { name: NOTIFICATIONS_QUEUE, handler: handleNotification },
];
