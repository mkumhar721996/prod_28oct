import { Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { AlertsService } from './alerts.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The player id comes from the session only, never from the URL or body. */
@Controller('alerts')
@UseGuards(SessionGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@Req() req: PlayerRequest) {
    return this.alerts.listFor(req.player.id);
  }

  @Get('unread-count')
  async unreadCount(@Req() req: PlayerRequest) {
    return { count: await this.alerts.unreadCountFor(req.player.id) };
  }

  @Post(':id/read')
  async read(@Req() req: PlayerRequest, @Param('id') id: string) {
    const alert = UUID.test(id) ? await this.alerts.markRead(req.player.id, id) : null;
    if (!alert) throw new NotFoundException('Alert not found.');
    return alert;
  }
}
