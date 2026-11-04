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
import { AccountsService } from '../accounts/accounts.service';
import { normaliseEmail } from '../players/players.service';
import { AttemptLimiter } from '../session/attempt-limiter.service';
import { AuthSessionService } from './auth-session.service';
import { ORG_SIGN_IN_REFUSAL } from './auth.constants';
import { AuthGuard, AuthRequest } from './auth.guard';

type Credentials = { email?: unknown; password?: unknown };

// Each password check costs a scrypt derivation, so sign-in is throttled like the other sign-ins.
const MAX_SIGN_IN_FAILURES = 10;

@Controller('auth/session')
export class AuthController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly sessions: AuthSessionService,
    private readonly limiter: AttemptLimiter,
  ) {}

  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body() body: Credentials,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipKey = `org-sign-in-ip:${req.ip}`;
    const emailKey = `org-sign-in-email:${normaliseEmail(body?.email)}`;
    this.limiter.assertAllowed(ipKey, MAX_SIGN_IN_FAILURES);
    this.limiter.assertAllowed(emailKey, MAX_SIGN_IN_FAILURES);
    // Reserve the attempt synchronously, before any await; a success gives the reservation back.
    this.limiter.record(ipKey);
    this.limiter.record(emailKey);
    const user = await this.accounts.authenticate(body?.email, body?.password);
    if (!user) throw new UnauthorizedException(ORG_SIGN_IN_REFUSAL);
    this.limiter.release(ipKey);
    this.limiter.reset(emailKey);
    await this.sessions.start(res, user.id);
    return { email: user.email, role: user.role };
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.end(req.headers.cookie, res);
  }

  @Get()
  @UseGuards(AuthGuard)
  current(@Req() req: AuthRequest) {
    return { email: req.user.email, role: req.user.role };
  }
}
