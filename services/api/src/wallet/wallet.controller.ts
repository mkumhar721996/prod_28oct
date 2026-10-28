import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(SessionGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /** The player id comes from the session only, never from the URL or body. */
  @Get()
  async balance(@Req() req: PlayerRequest) {
    return { balanceCredits: await this.wallet.balanceFor(req.player.id) };
  }
}
