// Creates one staff account (the operator-run way in; there is no in-app administrator).
// From services/api: STAFF_EMAIL=... STAFF_PASSWORD=... pnpm run create-staff   (needs DATABASE_URL)
// Credentials come from the environment, not argv, so the password stays out of shell history and the
// process list. It lives under src/ so `nest build` compiles it; validation and hashing are StaffService's.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { StaffService } from './staff.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const member = await app
      .get(StaffService)
      .create(process.env.STAFF_EMAIL, process.env.STAFF_PASSWORD);
    console.log(`created staff account ${member.email}`);
  } finally {
    await app.close();
  }
}

void main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
