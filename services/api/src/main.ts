import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Browsers reach the API through the web app's /session/* rewrite, so `req.ip` must be the real
  // client address taken from X-Forwarded-For. Trust exactly that many proxy hops (0 = none).
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
