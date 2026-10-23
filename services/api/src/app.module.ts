import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { RecordsModule } from './records/records.module';

@Module({
  imports: [RecordsModule],
  controllers: [AppController],
})
export class AppModule {}
