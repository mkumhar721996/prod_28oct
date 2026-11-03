import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [SessionModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
