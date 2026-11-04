import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module';
import { AppController } from './app.controller';
import { AppointmentsModule } from './appointments/appointments.module';
import { DatabaseModule } from './database/database.module';
import { OnboardingTemplatesModule } from './onboarding-templates/onboarding-templates.module';
import { RecordsModule } from './records/records.module';
import { SessionModule } from './session/session.module';
import { StaffModule } from './staff/staff.module';
import { TransfersModule } from './transfers/transfers.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    DatabaseModule,
    RecordsModule,
    SessionModule,
    WalletModule,
    AppointmentsModule,
    OnboardingTemplatesModule,
    StaffModule,
    AccountsModule,
    TransfersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
