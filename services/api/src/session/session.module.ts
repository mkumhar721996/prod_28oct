import { Module } from '@nestjs/common';
import { PlayersModule } from '../players/players.module';
import { SessionController } from './session.controller';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [PlayersModule],
  controllers: [SessionController],
  providers: [SessionService, SessionGuard],
  exports: [SessionService, SessionGuard],
})
export class SessionModule {}
