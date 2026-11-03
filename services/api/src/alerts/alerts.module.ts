import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [SessionModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
