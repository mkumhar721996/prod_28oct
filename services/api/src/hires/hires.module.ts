import { Module } from '@nestjs/common';
import { HrGuard } from '../session/hr.guard';
import { SessionModule } from '../session/session.module';
import { HiresController } from './hires.controller';
import { HiresService } from './hires.service';

@Module({
  imports: [SessionModule],
  controllers: [HiresController],
  providers: [HiresService, HrGuard],
})
export class HiresModule {}
