import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { PlayersService } from './players.service';

@Module({
  providers: [PasswordService, PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
