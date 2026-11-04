import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { IdentityVerificationsService, Submission } from './identity-verifications.service';

type Details = { fullName?: unknown; dateOfBirth?: unknown; idNumber?: unknown };

/** The customer's own verification. The player id comes from the session only, never from the URL or body. */
@Controller('identity-verification')
@UseGuards(SessionGuard)
export class IdentityVerificationsController {
  constructor(private readonly submissions: IdentityVerificationsService) {}

  @Get()
  async status(@Req() req: PlayerRequest) {
    return statusView(await this.submissions.latestFor(req.player.id));
  }

  @Post()
  async submit(@Req() req: PlayerRequest, @Body() body?: Details) {
    return statusView(
      await this.submissions.submit(req.player.id, {
        fullName: body?.fullName,
        dateOfBirth: body?.dateOfBirth,
        idNumber: body?.idNumber,
      }),
    );
  }
}

function statusView(s: Submission | null) {
  return {
    status: s?.status ?? 'none',
    fullName: s?.fullName ?? null,
    dateOfBirth: s?.dateOfBirth ?? null,
    idNumber: s?.idNumber ?? null,
    rejectionReason: s?.rejectionReason ?? null,
  };
}
