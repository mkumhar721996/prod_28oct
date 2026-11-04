import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { StaffModule } from '../staff/staff.module';
import { IdentityVerificationsController } from './identity-verifications.controller';
import { IdentityVerificationsService } from './identity-verifications.service';
import { IdentityVerificationsStaffController } from './identity-verifications.staff.controller';

@Module({
  imports: [SessionModule, StaffModule],
  controllers: [IdentityVerificationsStaffController, IdentityVerificationsController],
  providers: [IdentityVerificationsService],
})
export class IdentityVerificationsModule {}
