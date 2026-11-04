import { Module } from '@nestjs/common';
import { StaffModule } from '../staff/staff.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [StaffModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
