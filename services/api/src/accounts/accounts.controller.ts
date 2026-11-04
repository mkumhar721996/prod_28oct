import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AccountsService } from './accounts.service';

type NewAccount = { email?: unknown; password?: unknown; role?: unknown };

@Controller('accounts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('super_admin')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list() {
    return this.accounts.list();
  }

  /** Returns the account without its hash. */
  @Post()
  create(@Body() body: NewAccount) {
    return this.accounts.create(body?.email, body?.password, body?.role);
  }
}
