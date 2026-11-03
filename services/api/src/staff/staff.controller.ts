import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { normaliseEmail } from '../players/players.service';
import { AttemptLimiter } from '../session/attempt-limiter.service';
import { STAFF_REGISTER_REFUSAL, STAFF_SIGN_IN_REFUSAL } from './staff.constants';
import { StaffGuard, StaffRequest } from './staff.guard';
import { StaffService } from './staff.service';
import { StaffSessionService } from './staff-session.service';

type Credentials = { email?: unknown; password?: unknown };

// Each password check costs a scrypt derivation, so sign-in is throttled like the customer one.
const MAX_SIGN_IN_FAILURES = 10;

@Controller('staff/session')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly sessions: StaffSessionService,
    private readonly limiter: AttemptLimiter,
  ) {}

  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body() body: Credentials,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipKey = `staff-sign-in-ip:${req.ip}`;
    const emailKey = `staff-sign-in-email:${normaliseEmail(body?.email)}`;
    this.limiter.assertAllowed(ipKey, MAX_SIGN_IN_FAILURES);
    this.limiter.assertAllowed(emailKey, MAX_SIGN_IN_FAILURES);
    // Reserve the attempt synchronously, before any await; a success gives the reservation back.
    this.limiter.record(ipKey);
    this.limiter.record(emailKey);
    const member = await this.staff.authenticate(body?.email, body?.password);
    // One message for every cause: wrong password, unknown email, or a customer's credentials.
    if (!member) throw new UnauthorizedException(STAFF_SIGN_IN_REFUSAL);
    this.limiter.release(ipKey);
    this.limiter.reset(emailKey);
    await this.sessions.start(res, member.id);
    return { email: member.email };
  }

  /** Staff accounts are made by an administrator, so this never writes anything. */
  @Post('register')
  async register(@Body() _body: Credentials, @Req() _req: Request): Promise<never> {
    throw new ForbiddenException(STAFF_REGISTER_REFUSAL);
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.end(req.headers.cookie, res);
  }

  @Get()
  @UseGuards(StaffGuard)
  current(@Req() req: StaffRequest) {
    return { email: req.staff.email };
  }
}
