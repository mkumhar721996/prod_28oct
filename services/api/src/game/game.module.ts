import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [SessionModule],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
