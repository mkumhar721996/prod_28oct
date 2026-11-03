import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppointmentsModule } from './appointments/appointments.module';
import { DatabaseModule } from './database/database.module';
import { GameModule } from './game/game.module';
import { OnboardingTemplatesModule } from './onboarding-templates/onboarding-templates.module';
import { RecordsModule } from './records/records.module';
import { SessionModule } from './session/session.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    DatabaseModule,
    RecordsModule,
    SessionModule,
    WalletModule,
    GameModule,
    AppointmentsModule,
    OnboardingTemplatesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
