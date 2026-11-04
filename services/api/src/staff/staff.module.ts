import { Module } from '@nestjs/common';
import { PasswordService } from '../players/password.service';
import { AttemptLimiter } from '../session/attempt-limiter.service';
import { StaffController } from './staff.controller';
import { StaffGuard } from './staff.guard';
import { StaffService } from './staff.service';
import { StaffSessionService } from './staff-session.service';

@Module({
  controllers: [StaffController],
  providers: [PasswordService, StaffService, StaffSessionService, StaffGuard, AttemptLimiter],
  exports: [StaffService, StaffGuard],
})
export class StaffModule {}
