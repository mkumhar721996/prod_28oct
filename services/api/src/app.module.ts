import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AccountsModule } from './accounts/accounts.module';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { DatabaseModule } from './database/database.module';
import { OnboardingTemplatesModule } from './onboarding-templates/onboarding-templates.module';
import { RecordsModule } from './records/records.module';
import { SessionModule } from './session/session.module';
import { StaffModule } from './staff/staff.module';
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
    AlertsModule,
    AuthModule,
    AccountsModule,
    OrganizationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
