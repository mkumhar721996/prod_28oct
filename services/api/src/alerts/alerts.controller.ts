import { Controller, Get, HttpCode, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { AlertsService } from './alerts.service';

// A positive bigint that fits in 18 digits; anything else cannot be an alert id.
const ALERT_ID = /^[1-9]\d{0,17}$/;

/** The player id comes from the session only, never from the URL or body. */
@Controller('alerts')
@UseGuards(SessionGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  async list(@Req() req: PlayerRequest) {
    return { alerts: await this.alerts.listFor(req.player.id) };
  }

  @Get('unread-count')
  async unreadCount(@Req() req: PlayerRequest) {
    return { unreadCount: await this.alerts.unreadCountFor(req.player.id) };
  }

  @Post(':id/read')
  @HttpCode(200)
  async read(@Req() req: PlayerRequest, @Param('id') id: string) {
    const alert = ALERT_ID.test(id) ? await this.alerts.markRead(req.player.id, id) : null;
    if (!alert) throw new NotFoundException('Alert not found.');
    return alert;
  }
}
