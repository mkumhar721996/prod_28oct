import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JOB_ROLES, Owner } from '../onboarding-templates/onboarding-templates.constants';
import { MANAGERS, TEAM_ASSIGNEES } from './hires.constants';

const PLAN_INDEX = 'onboarding_plans_hire_uniq';
const UNIQUE_VIOLATION = '23505';

export type Hire = {
  id: string;
  name: string;
  role: string;
  roleName: string;
  startDate: string;
  managerName: string | null;
  planId: string | null;
};
export type PlanTask = {
  title: string;
  owner: Owner;
  assignee: string;
  dueOffsetDays: number;
  dueDate: string;
  status: 'not_started';
};
export type PlanView = {
  id: string;
  hireName: string;
  roleName: string;
  startDate: string;
  tasks: PlanTask[];
  doneCount: number;
};
type CreateRefusal = 'hire_not_found' | 'no_template' | 'no_manager' | 'plan_exists';
export type CreatePlanResult = { ok: true; planId: string } | { ok: false; code: CreateRefusal };
export type UpdateHireResult =
  | { ok: true }
  | { ok: false; code: 'hire_not_found' | 'invalid_start_date' | 'unknown_manager' };

const roleName = (role: string) => JOB_ROLES.find((r) => r.role === role)?.name ?? role;

/** True only for a real calendar day written YYYY-MM-DD (rejects 2026-02-31). */
function isCalendarDate(text: unknown): text is string {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

@Injectable()
export class HiresService {
  constructor(private readonly db: DatabaseService) {}

  managers(): string[] {
    return [...MANAGERS];
  }

  async getHire(id: string): Promise<Hire | null> {
    const { rows } = await this.db.pool.query(
      `select h.id, h.name, h.job_role, to_char(h.start_date, 'YYYY-MM-DD') as start_date, h.manager_name,
              (select p.id from onboarding_plans p where p.hire_id = h.id) as plan_id
         from hires h where h.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      role: r.job_role,
      roleName: roleName(r.job_role),
      startDate: r.start_date,
      managerName: r.manager_name,
      planId: r.plan_id,
    };
  }

  async updateHire(
    id: string,
    patch: { startDate?: string; managerName?: string | null },
  ): Promise<UpdateHireResult> {
    if (patch.startDate !== undefined && !isCalendarDate(patch.startDate)) {
      return { ok: false, code: 'invalid_start_date' };
    }
    if (
      patch.managerName !== undefined &&
      patch.managerName !== null &&
      !MANAGERS.includes(patch.managerName as (typeof MANAGERS)[number])
    ) {
      return { ok: false, code: 'unknown_manager' };
    }
    let found = true;
    // Plan tasks keep only their offsets, so moving the start date moves every due date with no plan write.
    if (patch.startDate !== undefined) {
      const res = await this.db.pool.query('update hires set start_date = $2 where id = $1', [id, patch.startDate]);
      found = (res.rowCount ?? 0) > 0;
    }
    if (found && patch.managerName !== undefined) {
      const res = await this.db.pool.query('update hires set manager_name = $2 where id = $1', [
        id,
        patch.managerName,
      ]);
      found = (res.rowCount ?? 0) > 0;
    }
    return found ? { ok: true } : { ok: false, code: 'hire_not_found' };
  }

  /**
   * Copies the role template's tasks into a new plan in one transaction. The hire row is locked and the
   * unique index on the hire decides duplicates. Tasks are copied by value, with no link to template tasks.
   */
  async createPlan(hireId: string): Promise<CreatePlanResult> {
    const client = await this.db.pool.connect();
    try {
      await client.query('begin');
      const refuse = async (code: CreateRefusal) => {
        await client.query('rollback');
        return { ok: false, code } as const;
      };
      const { rows: hires } = await client.query(
        `select h.id, h.name, h.job_role, h.manager_name,
                (select p.id from onboarding_plans p where p.hire_id = h.id) as plan_id
           from hires h where h.id = $1 for update`,
        [hireId],
      );
      const hire = hires[0];
      if (!hire) return await refuse('hire_not_found');
      if (hire.plan_id) return await refuse('plan_exists');

      const { rows: templates } = await client.query(
        'select id from onboarding_templates t where t.job_role = $1',
        [hire.job_role],
      );
      const template = templates[0];
      const { rows: tasks } = template
        ? await client.query(
            `select title, owner, due_offset_days from onboarding_template_tasks
              where template_id = $1 order by position`,
            [template.id],
          )
        : { rows: [] };
      if (!template || tasks.length === 0) return await refuse('no_template');

      const manager = typeof hire.manager_name === 'string' ? hire.manager_name.trim() : '';
      if (!manager && tasks.some((t: { owner: Owner }) => t.owner === 'hiring_manager')) {
        return await refuse('no_manager');
      }
      const assigneeOf = (owner: Owner): string =>
        owner === 'hiring_manager' ? manager : owner === 'new_hire' ? hire.name : TEAM_ASSIGNEES[owner];

      const { rows: plans } = await client.query(
        'insert into onboarding_plans (template_id, job_role, hire_id) values ($1, $2, $3) returning id',
        [template.id, hire.job_role, hire.id],
      );
      const planId = plans[0].id as string;
      await client.query(
        `insert into onboarding_plan_tasks (plan_id, position, title, owner, due_offset_days, assignee)
         select $1, * from unnest($2::int[], $3::text[], $4::text[], $5::int[], $6::text[])`,
        [
          planId,
          tasks.map((_: unknown, i: number) => i),
          tasks.map((t: { title: string }) => t.title),
          tasks.map((t: { owner: Owner }) => t.owner),
          tasks.map((t: { due_offset_days: number }) => t.due_offset_days),
          tasks.map((t: { owner: Owner }) => assigneeOf(t.owner)),
        ],
      );
      await client.query('commit');
      return { ok: true, planId };
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      const e = err as { code?: string; constraint?: string };
      if (e.code === UNIQUE_VIOLATION && e.constraint === PLAN_INDEX) return { ok: false, code: 'plan_exists' };
      throw err;
    } finally {
      client.release();
    }
  }

  /** The hire's plan, earliest due date first; null when the hire has none. Dates are start date + offset. */
  async getPlan(hireId: string): Promise<PlanView | null> {
    const { rows } = await this.db.pool.query(
      `select p.id, h.name as hire_name, p.job_role, to_char(h.start_date, 'YYYY-MM-DD') as start_date,
              t.title, t.owner, t.assignee, t.due_offset_days, t.status,
              to_char(h.start_date + t.due_offset_days, 'YYYY-MM-DD') as due_date
         from onboarding_plan_tasks t
         join onboarding_plans p on p.id = t.plan_id
         join hires h on h.id = p.hire_id
        where p.hire_id = $1
        order by t.due_offset_days, t.position`,
      [hireId],
    );
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      hireName: rows[0].hire_name,
      roleName: roleName(rows[0].job_role),
      startDate: rows[0].start_date,
      tasks: rows.map((r) => ({
        title: r.title,
        owner: r.owner,
        assignee: r.assignee ?? '',
        dueOffsetDays: r.due_offset_days,
        dueDate: r.due_date,
        status: 'not_started' as const,
      })),
      doneCount: 0,
    };
  }
}
