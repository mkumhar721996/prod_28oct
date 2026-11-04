import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { TransfersService } from './transfers.service';

type TransferBody = { fromId?: unknown; toId?: unknown; amount?: unknown };

@Controller('transfers')
@UseGuards(SessionGuard)
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  /** The customer is the session's player; they must own the source account. */
  @Post()
  async create(@Body() body: TransferBody, @Req() req: PlayerRequest) {
    const { fromId, toId, amount } = body ?? {};
    if (typeof fromId !== 'string' || typeof toId !== 'string') {
      throw new BadRequestException({ code: 'invalid_accounts' });
    }
    const result = await this.transfers.transfer(req.player.id, fromId, toId, amount);
    if (result.ok) return { ok: true };
    if (result.reason === 'not_found') throw new NotFoundException();
    if (result.reason === 'invalid_amount' || result.reason === 'same_account') {
      throw new BadRequestException({ code: result.reason });
    }
    throw new ConflictException({ code: result.reason });
  }
}
