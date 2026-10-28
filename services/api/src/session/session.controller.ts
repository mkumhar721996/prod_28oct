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
import type { Request, Response } from 'express';
import { PlayersService, normaliseEmail } from '../players/players.service';
import { AttemptLimiter } from './attempt-limiter.service';
import { PlayerRequest, SessionGuard } from './session.guard';
import { SessionService } from './session.service';

type Credentials = { email?: unknown; password?: unknown };

// Each password check costs a scrypt derivation, so both entry points are throttled.
const MAX_SIGN_IN_FAILURES = 10;
const MAX_REGISTRATIONS_PER_IP = 20;

@Controller('session')
export class SessionController {
  constructor(
    private readonly players: PlayersService,
    private readonly sessions: SessionService,
    private readonly limiter: AttemptLimiter,
  ) {}

  @Post('register')
  async register(
    @Body() body: Credentials,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipKey = `register:${req.ip}`;
    this.limiter.assertAllowed(ipKey, MAX_REGISTRATIONS_PER_IP);
    this.limiter.record(ipKey);
    const player = await this.players.register(body?.email, body?.password);
    await this.sessions.start(res, player.id);
    return { role: 'player', email: player.email };
  }

  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body() body: Credentials,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipKey = `sign-in-ip:${req.ip}`;
    const emailKey = `sign-in-email:${normaliseEmail(body?.email)}`;
    this.limiter.assertAllowed(ipKey, MAX_SIGN_IN_FAILURES);
    this.limiter.assertAllowed(emailKey, MAX_SIGN_IN_FAILURES);
    const player = await this.players.authenticate(body?.email, body?.password);
    if (!player) {
      this.limiter.record(ipKey);
      this.limiter.record(emailKey);
      throw new UnauthorizedException('Email or password incorrect');
    }
    this.limiter.reset(emailKey);
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
