import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { JOB_ROLES, LATEST_DUE_DAY, OWNERS, Owner, TITLE_MAX } from './onboarding-templates.constants';

const ROLE_INDEX = 'onboarding_templates_role_uniq';
const UNIQUE_VIOLATION = '23505';

/** A task as the editor sends it; owner and due date may be missing and are checked here. */
export type TaskInput = { title: string; owner: Owner | null; dueOffsetDays: number | null };
export type SaveRefusal =
  | 'unknown_role'
  | 'no_tasks'
  | 'title_missing'
  | 'owner_missing'
  | 'due_missing'
  | 'due_too_late'
  | 'role_exists'
  | 'not_found';
export type SaveResult = { ok: true } | { ok: false; code: SaveRefusal; taskIndex?: number };

export type TemplateTask = { title: string; owner: Owner; dueOffsetDays: number };
export type TemplateView = { role: string; name: string; planCount: number; tasks: TemplateTask[] };
export type TemplateSummary = { role: string; name: string; taskCount: number; planCount: number };

const roleName = (role: string) => JOB_ROLES.find((r) => r.role === role)?.name ?? role;

/** The first problem in the tasks, naming the task, or null when all are valid. */
function validate(tasks: TaskInput[]): SaveResult | null {
  if (tasks.length === 0) return { ok: false, code: 'no_tasks' };
  for (const [taskIndex, t] of tasks.entries()) {
    const title = typeof t?.title === 'string' ? t.title.trim() : '';
    if (title.length === 0 || title.length > TITLE_MAX) {
      return { ok: false, code: 'title_missing', taskIndex };
    }
    if (!OWNERS.includes(t.owner as Owner)) return { ok: false, code: 'owner_missing', taskIndex };
    if (!Number.isInteger(t.dueOffsetDays)) return { ok: false, code: 'due_missing', taskIndex };
    if ((t.dueOffsetDays as number) > LATEST_DUE_DAY) {
      return { ok: false, code: 'due_too_late', taskIndex };
    }
  }
  return null;
}

@Injectable()
export class OnboardingTemplatesService {
  constructor(private readonly db: DatabaseService) {}

  /** The fixed job-role list. */
  roles(): { role: string; name: string }[] {
    return JOB_ROLES.map(({ role, name }) => ({ role, name }));
  }

  async list(): Promise<TemplateSummary[]> {
    const { rows } = await this.db.pool.query(
      `select t.job_role,
              (select count(*)::int from onboarding_template_tasks k where k.template_id = t.id) as task_count,
              (select count(*)::int from onboarding_plans p where p.template_id = t.id) as plan_count
         from onboarding_templates t order by t.created_at`,
    );
    return rows.map((r: { job_role: string; task_count: number; plan_count: number }) => ({
      role: r.job_role,
      name: roleName(r.job_role),
      taskCount: r.task_count,
      planCount: r.plan_count,
    }));
  }

  /** The template with tasks from earliest to latest due date; null when the role has none. */
  async get(role: string): Promise<TemplateView | null> {
    const { rows } = await this.db.pool.query(
      `select t.id, t.job_role,
              (select count(*)::int from onboarding_plans p where p.template_id = t.id) as plan_count
         from onboarding_templates t where t.job_role = $1`,
      [role],
    );
    const template = rows[0] as { id: string; job_role: string; plan_count: number } | undefined;
    if (!template) return null;
    const tasks = await this.db.pool.query(
      `select title, owner, due_offset_days from onboarding_template_tasks
        where template_id = $1 order by due_offset_days, position`,
      [template.id],
    );
    return {
      role: template.job_role,
      name: roleName(template.job_role),
      planCount: template.plan_count,
      tasks: tasks.rows.map((r: { title: string; owner: Owner; due_offset_days: number }) => ({
        title: r.title,
        owner: r.owner,
        dueOffsetDays: r.due_offset_days,
      })),
    };
  }

  /**
   * Creates or replaces a role's template in one transaction. The unique index on the role decides
   * duplicates, so concurrent creates cannot both win. Edit replaces the template's own task rows
   * only: hire plans hold copies and are never read or written here.
   */
  async save(mode: 'create' | 'edit', role: string, tasks: TaskInput[]): Promise<SaveResult> {
    if (!JOB_ROLES.some((r) => r.role === role)) return { ok: false, code: 'unknown_role' };
    const invalid = validate(tasks);
    if (invalid) return invalid;

    const client = await this.db.pool.connect();
    try {
      await client.query('begin');
      const templateId = mode === 'create' ? await this.insertTemplate(client, role) : await this.lock(client, role);
      if (templateId === null) {
        await client.query('rollback');
        return { ok: false, code: mode === 'create' ? 'role_exists' : 'not_found' };
      }
      if (mode === 'edit') {
        await client.query('delete from onboarding_template_tasks where template_id = $1', [templateId]);
      }
      await client.query(
        `insert into onboarding_template_tasks (template_id, position, title, owner, due_offset_days)
         select $1, * from unnest($2::int[], $3::text[], $4::text[], $5::int[])`,
        [
          templateId,
          tasks.map((_, i) => i),
          tasks.map((t) => t.title.trim()),
          tasks.map((t) => t.owner),
          tasks.map((t) => t.dueOffsetDays),
        ],
      );
      if (mode === 'edit') {
        await client.query('update onboarding_templates set updated_at = now() where id = $1', [templateId]);
      }
      await client.query('commit');
      return { ok: true };
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      const e = err as { code?: string; constraint?: string };
      if (e.code === UNIQUE_VIOLATION && e.constraint === ROLE_INDEX) {
        return { ok: false, code: 'role_exists' };
      }
      throw err;
    } finally {
      client.release();
    }
  }

  private async insertTemplate(client: PoolClient, role: string): Promise<string> {
    const { rows } = await client.query(
      'insert into onboarding_templates (job_role) values ($1) returning id',
      [role],
    );
    return rows[0].id;
  }

  private async lock(client: PoolClient, role: string): Promise<string | null> {
    const { rows } = await client.query(
      'select id from onboarding_templates where job_role = $1 for update',
      [role],
    );
    return rows[0]?.id ?? null;
  }
}
