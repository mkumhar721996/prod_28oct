import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { HiresModule } from './hires/hires.module';
import { RecordsModule } from './records/records.module';

@Module({
  imports: [RecordsModule, HiresModule],
  controllers: [AppController],
})
export class AppModule {}
