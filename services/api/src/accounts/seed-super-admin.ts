// Deployment setup step: creates the first super-admin, or does nothing if that email exists.
// From services/api, after `pnpm run migrate`:
//   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... pnpm run seed-super-admin   (needs DATABASE_URL)
// Credentials come from the environment, not argv, so the password stays out of shell history.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AccountsService } from './accounts.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const result = await app
      .get(AccountsService)
      .ensureSuperAdmin(email, process.env.SUPER_ADMIN_PASSWORD);
    console.log(
      result === 'created' ? `created super-admin ${email}` : `super-admin ${email} already exists`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
