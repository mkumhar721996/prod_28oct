import { Pool } from 'pg';
import PgBoss from 'pg-boss';
import { Config } from './config';
import { buildJobs } from './jobs';

export type Worker = { boss: PgBoss; stop: () => Promise<void> };

export async function startWorker(config: Config): Promise<Worker> {
  const pool = new Pool({ connectionString: config.databaseUrl });
  const boss = new PgBoss(config.databaseUrl);
  boss.on('error', (err) => console.error('pg-boss error', err));
  await boss.start();

  for (const job of buildJobs(pool)) {
    await boss.createQueue(job.name, { name: job.name, ...job.queueOptions });
    const options = job.pollingIntervalSeconds ? { pollingIntervalSeconds: job.pollingIntervalSeconds } : {};
    await boss.work(job.name, options, async (batch) => {
      for (const item of batch) {
        await job.handler(item.data);
      }
    });
    if (job.schedule) {
      await boss.schedule(job.name, job.schedule);
    }
  }
  return {
    boss,
    stop: async () => {
      await boss.stop();
      await pool.end();
    },
  };
}
