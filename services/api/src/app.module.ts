import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AlertsModule } from './alerts/alerts.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { DatabaseModule } from './database/database.module';
import { OnboardingTemplatesModule } from './onboarding-templates/onboarding-templates.module';
import { RecordsModule } from './records/records.module';
import { SessionModule } from './session/session.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [DatabaseModule, RecordsModule, SessionModule, WalletModule, AppointmentsModule, OnboardingTemplatesModule, AlertsModule],
  controllers: [AppController],
})
export class AppModule {}
