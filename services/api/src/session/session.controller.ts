import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PlayersService } from '../players/players.service';
import { PlayerRequest, SessionGuard } from './session.guard';
import { SessionService } from './session.service';

type Credentials = { email?: unknown; password?: unknown };

@Controller('session')
export class SessionController {
  constructor(
    private readonly players: PlayersService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  async register(@Body() body: Credentials, @Res({ passthrough: true }) res: Response) {
    const player = await this.players.register(body?.email, body?.password);
    await this.sessions.start(res, player.id);
    return { role: 'player', email: player.email };
  }

  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: Credentials, @Res({ passthrough: true }) res: Response) {
    const player = await this.players.authenticate(body?.email, body?.password);
    if (!player) throw new UnauthorizedException('Email or password incorrect');
    await this.sessions.start(res, player.id);
    return { role: 'player', email: player.email };
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(@Req() req: PlayerRequest, @Res({ passthrough: true }) res: Response) {
    await this.sessions.end(req.headers.cookie, res);
  }

  @Get()
  @UseGuards(SessionGuard)
  current(@Req() req: PlayerRequest) {
    return { role: 'player', email: req.player.email };
  }
}
