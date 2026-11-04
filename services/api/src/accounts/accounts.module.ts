import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { TransfersService } from './transfers.service';

@Module({
  imports: [SessionModule],
  controllers: [AccountsController],
  providers: [AccountsService, TransfersService],
  exports: [TransfersService],
})
export class AccountsModule {}
