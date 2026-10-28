// Applies every migrations/*.sql in name order. The files are idempotent (create ... if not exists).
// Run from services/api: pnpm run migrate   (needs DATABASE_URL)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const dir = join(process.cwd(), 'migrations');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      await client.query(readFileSync(join(dir, file), 'utf8'));
      console.log(`applied ${file}`);
    }
  } finally {
    await client.end();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
