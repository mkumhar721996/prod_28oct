import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { HrGuard } from '../session/hr.guard';
import { SessionGuard } from '../session/session.guard';
import { JOB_ROLES } from './onboarding-templates.constants';
import { OnboardingTemplatesService, SaveRefusal, TaskInput } from './onboarding-templates.service';

const BAD_REQUEST_MESSAGES: Partial<Record<SaveRefusal, string>> = {
  unknown_role: 'Choose a role from the list.',
  no_tasks: 'Add at least one task before saving.',
  title_missing: 'Enter a task name, like “Set up laptop”.',
  owner_missing: 'Choose an owner for this task.',
  due_missing: 'Set a due date: enter the number of days, like 30.',
  due_too_late: 'Day 90 is the latest allowed due date. Enter 90 or fewer.',
};

type SaveBody = { role?: unknown; tasks?: unknown };

/** Anything not shaped like a task becomes a task the service refuses, never a crash. */
function toTasks(raw: unknown): TaskInput[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((t) => ({
    title: t?.title,
    owner: t?.owner ?? null,
    dueOffsetDays: t?.dueOffsetDays ?? null,
  }));
}

@Controller('onboarding-templates')
@UseGuards(SessionGuard)
export class OnboardingTemplatesController {
  constructor(private readonly templates: OnboardingTemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get('roles')
  roles() {
    return this.templates.roles();
  }

  @Get(':role')
  async get(@Param('role') role: string) {
    const template = await this.templates.get(role);
    if (!template) throw new NotFoundException('There is no template for this role.');
    return template;
  }

  /** Writes are HR only, enforced here on the server and not just by hiding the buttons. */
  @Post()
  @UseGuards(HrGuard)
  async create(@Body() body: SaveBody) {
    const tasks = toTasks(body?.tasks);
    if (typeof body?.role !== 'string' || !tasks) {
      throw new BadRequestException('Choose a role and add its tasks.');
    }
    return this.save('create', body.role, tasks);
  }

  @Put(':role')
  @UseGuards(HrGuard)
  async edit(@Param('role') role: string, @Body() body: SaveBody) {
    const tasks = toTasks(body?.tasks);
    if (!tasks) throw new BadRequestException('Add the template tasks.');
    return this.save('edit', role, tasks);
  }

  private async save(mode: 'create' | 'edit', role: string, tasks: TaskInput[]) {
    const result = await this.templates.save(mode, role, tasks);
    if (result.ok) return { ok: true };
    const { code, taskIndex } = result;
    if (code === 'role_exists') {
      const name = JOB_ROLES.find((r) => r.role === role)?.name ?? role;
      throw new ConflictException({
        code,
        message: `A template already exists for ${name}. Edit it from the templates list instead.`,
      });
    }
    if (code === 'not_found') throw new NotFoundException('There is no template for this role.');
    throw new BadRequestException({
      code,
      taskIndex,
      message: BAD_REQUEST_MESSAGES[code] ?? 'That template is not valid.',
    });
  }
}
