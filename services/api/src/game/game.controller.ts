import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { insufficientMessage } from './game.constants';
import { GameService } from './game.service';

@Controller('game')
@UseGuards(SessionGuard)
export class GameController {
  constructor(private readonly game: GameService) {}

  /** The player id comes from the session only, never from the URL or body. */
  @Get()
  state(@Req() req: PlayerRequest) {
    return this.game.stateFor(req.player.id);
  }

  @Post('spin')
  @HttpCode(200)
  async spin(@Req() req: PlayerRequest, @Body() body?: { bet?: unknown }) {
    const result = await this.game.spin(req.player.id, body?.bet);
    if (result.ok) {
      const { ok: _ok, ...spin } = result;
      return spin;
    }
    if (result.reason === 'invalid_bet') {
      throw new BadRequestException('Choose a bet of 10, 25, 50, 100 or 250.');
    }
    const balanceCredits = result.balanceCredits ?? 0;
    throw new ConflictException({
      message: insufficientMessage(balanceCredits, Number(body?.bet)),
      balanceCredits,
    });
  }
}
