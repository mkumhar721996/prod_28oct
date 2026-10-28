import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

/** Owns the PostgreSQL pool. Fails fast when DATABASE_URL is unset. */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
