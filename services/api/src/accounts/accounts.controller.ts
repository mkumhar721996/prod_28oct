import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffGuard, StaffRequest } from '../staff/staff.guard';
import { REASON_REQUIRED_MESSAGE } from './accounts.constants';
import { AccountsService, FreezeResult } from './accounts.service';

/** Every route is staff-only: a customer cookie fails StaffGuard with 401. */
@Controller('staff/accounts')
@UseGuards(StaffGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  search(@Query('q') q?: string) {
    return this.accounts.search(typeof q === 'string' ? q : '');
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const account = await this.accounts.get(id);
    if (!account) throw new NotFoundException();
    return account;
  }

  @Post(':id/freeze')
  async freeze(@Param('id') id: string, @Body() body: { reason?: unknown }, @Req() req: StaffRequest) {
    return this.unwrap(await this.accounts.freeze(id, req.staff.id, body?.reason));
  }

  @Post(':id/unfreeze')
  async unfreeze(@Param('id') id: string, @Req() req: StaffRequest) {
    return this.unwrap(await this.accounts.unfreeze(id, req.staff.id));
  }

  private unwrap(result: FreezeResult) {
    if (result.ok) return result.account;
    if (result.reason === 'reason_required') {
      throw new BadRequestException({ code: 'reason_required', message: REASON_REQUIRED_MESSAGE });
    }
    if (result.reason === 'not_found') throw new NotFoundException();
    throw new ConflictException({ code: 'already_frozen', message: 'This account is already frozen.' });
  }
}
