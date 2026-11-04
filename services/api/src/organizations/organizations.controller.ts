import { Body, Controller, Delete, Get, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrganizationsService } from './organizations.service';

type Edit = { name?: unknown; address?: unknown };

/** Every route needs a signed-in user; only delete is limited by role. */
@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list() {
    return this.organizations.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.organizations.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Edit) {
    return this.organizations.update(id, body?.name, body?.address);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.organizations.remove(id);
  }
}
