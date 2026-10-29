import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import {
  BET_ABOVE_BALANCE_MESSAGE,
  INVALID_BET_MESSAGE,
  TOP_UP_NOT_LOW_MESSAGE,
  canBet,
} from './wallet.constants';
import { HistoryRange, WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(SessionGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /** The player id comes from the session only, never from the URL or body. */
  @Get()
  async balance(@Req() req: PlayerRequest) {
    const balanceCredits = await this.wallet.balanceFor(req.player.id);
    return {
      balanceCredits,
      topUp: { eligible: !canBet(balanceCredits), credits: this.wallet.topUpCredits },
    };
  }

  /** The rule is enforced in SQL, so calling this when the balance is not low mints nothing. */
  @Post('top-up')
  @HttpCode(200)
  async topUp(@Req() req: PlayerRequest) {
    const result = await this.wallet.claimTopUp(req.player.id);
    if (!result.ok) {
      throw new ConflictException(TOP_UP_NOT_LOW_MESSAGE);
    }
    return { balanceCredits: result.balanceCredits, grantedCredits: this.wallet.topUpCredits };
  }

  /** Refused (balance and history untouched) when the bet is larger than the balance. */
  @Post('bet')
  @HttpCode(200)
  async bet(@Req() req: PlayerRequest, @Body() body: { amount?: unknown }) {
    const result = await this.wallet.placeBet(req.player.id, body?.amount);
    if (!result.ok) {
      throw result.reason === 'invalid_amount'
        ? new BadRequestException(INVALID_BET_MESSAGE)
        : new ConflictException(BET_ABOVE_BALANCE_MESSAGE);
    }
    return { balanceCredits: result.balanceCredits };
  }

  @Get('history')
  history(
    @Req() req: PlayerRequest,
    @Query('page') page?: string,
    @Query('range') range?: string,
  ) {
    const parsed = Number(page);
    return this.wallet.historyFor(req.player.id, {
      page: Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1,
      range: (range === 'all' ? 'all' : 'recent') satisfies HistoryRange,
    });
  }
}
