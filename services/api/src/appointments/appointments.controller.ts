import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { AppointmentsService, BookInput, BookRefusal } from './appointments.service';

const CONFLICT_MESSAGES: Partial<Record<BookRefusal, string>> = {
  slot_taken: 'That time is no longer available. Pick another time. Nothing has been booked.',
  already_booked: 'You already have an appointment at this time. Pick a different time.',
};

const isText = (v: unknown): v is string => typeof v === 'string';

@Controller('appointments')
@UseGuards(SessionGuard)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('clinics')
  clinics() {
    return this.appointments.listClinics().map(({ id, name, hoursText }) => ({ id, name, hoursText }));
  }

  @Get('clinics/:id/slots')
  async slots(@Param('id') id: string) {
    const days = await this.appointments.slotsForClinic(id);
    if (!days) throw new NotFoundException('Unknown clinic.');
    return days;
  }

  /** The player id comes from the session only, never from the URL or body. */
  @Get()
  list(@Req() req: PlayerRequest) {
    return this.appointments.listFor(req.player.id);
  }

  @Post()
  async book(@Req() req: PlayerRequest, @Body() body: BookInput) {
    const { clinicId, date, time, reason = '' } = body ?? ({} as BookInput);
    if (![clinicId, date, time, reason].every(isText)) {
      throw new BadRequestException('Choose a clinic and a time.');
    }
    const input = { clinicId, date, time, reason };
    const result = await this.appointments.book(req.player.id, input);
    if (result.ok) return { appointment: result.appointment };
    const message = CONFLICT_MESSAGES[result.code];
    if (message) throw new ConflictException({ code: result.code, message });
    throw new BadRequestException({ code: result.code, message: 'That booking is not valid.' });
  }
}
