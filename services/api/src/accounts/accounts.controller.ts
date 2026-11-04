import { Body, ConflictException, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { ACCOUNT_LABELS, refusalMessage } from './accounts.constants';
import { AccountsService } from './accounts.service';
import { TransferInput, TransfersService } from './transfers.service';

@Controller()
@UseGuards(SessionGuard)
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly transfers: TransfersService,
  ) {}

  /** The player id comes from the session only, never from the URL or body. */
  @Get('accounts')
  list(@Req() req: PlayerRequest) {
    return this.accounts.listFor(req.player.id);
  }

  @Post('transfers')
  @HttpCode(200)
  async transfer(@Req() req: PlayerRequest, @Body() body: TransferInput) {
    const { fromAccountId, toAccountId, amount, idempotencyKey } = body ?? ({} as TransferInput);
    const result = await this.transfers.execute(req.player.id, {
      fromAccountId,
      toAccountId,
      amount,
      idempotencyKey,
    });
    if (!result.ok) {
      const mine = await this.accounts.listFor(req.player.id);
      const source = mine.find((a) => a.id === fromAccountId);
      const destination = mine.find((a) => a.id === toAccountId);
      throw new ConflictException({
        message: refusalMessage(result.reason, {
          sourceLabel: source && ACCOUNT_LABELS[source.kind],
          destinationLabel: destination && ACCOUNT_LABELS[destination.kind],
          available: source?.balance,
          amount: typeof amount === 'number' ? amount : undefined,
        }),
        reason: result.reason,
      });
    }
    return {
      transferId: result.transferId,
      reference: `TRF-${result.transferId.slice(0, 8).toUpperCase()}`,
      from: result.from,
      to: result.to,
      replayed: result.replayed,
    };
  }
}
