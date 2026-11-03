import { loadConfig } from './config';
import { startWorker } from './worker';

async function main(): Promise<void> {
  const worker = await startWorker(loadConfig());
  console.log('background worker started');

  const shutdown = async () => {
    await worker.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
