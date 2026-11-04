import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PasswordService } from '../players/password.service';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AccountsController],
  providers: [PasswordService, AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
