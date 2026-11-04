import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [SessionModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
