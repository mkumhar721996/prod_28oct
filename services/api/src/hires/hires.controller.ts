import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { HrGuard } from '../session/hr.guard';
import { SessionGuard } from '../session/session.guard';
import { HiresService } from './hires.service';

type PatchBody = { startDate?: unknown; managerName?: unknown };

@Controller('hires')
@UseGuards(SessionGuard, HrGuard)
export class HiresController {
  constructor(private readonly hires: HiresService) {}

  @Get('managers')
  managers() {
    return this.hires.managers();
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const hire = await this.hires.getHire(id);
    if (!hire) throw new NotFoundException('There is no such hire.');
    return hire;
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: PatchBody) {
    const { startDate, managerName } = body ?? {};
    if (startDate !== undefined && typeof startDate !== 'string') {
      throw new BadRequestException({ code: 'invalid_start_date', message: 'Enter a start date like 08/12/2026.' });
    }
    if (managerName !== undefined && managerName !== null && typeof managerName !== 'string') {
      throw new BadRequestException({ code: 'unknown_manager', message: 'Choose a manager from the list.' });
    }
    const result = await this.hires.updateHire(id, { startDate, managerName });
    if (result.ok) return { ok: true };
    if (result.code === 'hire_not_found') throw new NotFoundException('There is no such hire.');
    throw new BadRequestException({
      code: result.code,
      message:
        result.code === 'invalid_start_date'
          ? 'Enter a start date like 08/12/2026.'
          : 'Choose a manager from the list.',
    });
  }

  @Post(':id/plan')
  @HttpCode(201)
  async createPlan(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.hires.createPlan(id);
    if (result.ok) return { planId: result.planId };
    if (result.code === 'hire_not_found') throw new NotFoundException('There is no such hire.');
    if (result.code === 'plan_exists') {
      throw new ConflictException({ code: result.code, message: 'This hire already has a plan.' });
    }
    if (result.code === 'no_manager') {
      throw new UnprocessableEntityException({
        code: result.code,
        message: 'Plan not created: this hire has no manager. Choose a manager on the hire record, then try again.',
      });
    }
    const hire = await this.hires.getHire(id);
    const name = hire?.roleName ?? 'this';
    throw new UnprocessableEntityException({
      code: result.code,
      message: `Plan not created: the ${name} role has no onboarding template. Create the template first, then try again.`,
    });
  }

  @Get(':id/plan')
  async plan(@Param('id', ParseUUIDPipe) id: string) {
    const plan = await this.hires.getPlan(id);
    if (!plan) throw new NotFoundException('This hire has no plan yet.');
    return plan;
  }
}
