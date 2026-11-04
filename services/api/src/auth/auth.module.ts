import { forwardRef, Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AttemptLimiter } from '../session/attempt-limiter.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthSessionService } from './auth-session.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [forwardRef(() => AccountsModule)],
  controllers: [AuthController],
  providers: [AuthSessionService, AuthGuard, RolesGuard, AttemptLimiter],
  exports: [AuthSessionService, AuthGuard, RolesGuard],
})
export class AuthModule {}
