import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { StaffGuard, StaffRequest } from '../staff/staff.guard';
import { IdentityVerificationsService } from './identity-verifications.service';

// A positive bigint that fits in 18 digits; anything else cannot be a submission id.
const SUBMISSION_ID = /^[1-9]\d{0,17}$/;

/** Staff review of ID submissions. The staff id comes from the staff session only, never from the URL or body. */
@Controller('staff/identity-verifications')
@UseGuards(StaffGuard)
export class IdentityVerificationsStaffController {
  constructor(private readonly submissions: IdentityVerificationsService) {}

  @Get()
  async list(@Query('status') status?: string) {
    const submissions =
      status === 'decided' ? await this.submissions.listDecided() : await this.submissions.listPending();
    return { submissions };
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const submission = SUBMISSION_ID.test(id) ? await this.submissions.get(id) : null;
    if (!submission) throw new NotFoundException('Submission not found.');
    return submission;
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Req() req: StaffRequest, @Param('id') id: string) {
    return this.submissions.decide(validId(id), req.staff.id, { kind: 'approve' });
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Req() req: StaffRequest, @Param('id') id: string, @Body() body?: { reason?: unknown }) {
    return this.submissions.decide(validId(id), req.staff.id, { kind: 'reject', reason: body?.reason });
  }
}

function validId(id: string): string {
  if (!SUBMISSION_ID.test(id)) throw new NotFoundException('Submission not found.');
  return id;
}
