import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { RecordsModule } from './records/records.module';
import { SessionModule } from './session/session.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [DatabaseModule, RecordsModule, SessionModule, WalletModule],
  controllers: [AppController],
})
export class AppModule {}
