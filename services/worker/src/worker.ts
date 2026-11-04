import PgBoss from 'pg-boss';
import { Config } from './config';
import { closeJobResources, jobs } from './jobs';

export async function startWorker(config: Config): Promise<PgBoss> {
  const boss = new PgBoss(config.databaseUrl);
  boss.on('error', (err) => console.error('pg-boss error', err));
  await boss.start();

  for (const job of jobs) {
    await boss.createQueue(
      job.name,
      job.retryLimit === undefined ? undefined : { name: job.name, retryLimit: job.retryLimit, retryBackoff: true },
    );
    await boss.work(job.name, async (batch) => {
      for (const item of batch) {
        await job.handler(item.data);
      }
    });
    if (job.schedule) {
      await boss.schedule(job.name, job.schedule);
    }
  }
  // Close the jobs' database pool with the worker.
  boss.on('stopped', () => void closeJobResources());
  return boss;
}
