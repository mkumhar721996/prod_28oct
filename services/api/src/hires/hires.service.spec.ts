import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '../database/database.service';
import { HiresService } from './hires.service';

type Row = Record<string, unknown>;
type Call = [string, unknown[] | undefined];

const HIRE = { id: 'hire-1', name: 'Alex Morgan', job_role: 'software-engineer', manager_name: 'Dana Lee', plan_id: null };
const tpl = (title: string, owner: string, due = -30) => ({ title, owner, due_offset_days: due });

type World = { hire?: Row | null; template?: Row | null; tasks?: Row[]; planRows?: Row[]; insertPlanError?: Error };

function setup(world: World = {}) {
  const hire = world.hire === undefined ? HIRE : world.hire;
  const template = world.template === undefined ? { id: 'tpl-1' } : world.template;
  const tasks = world.tasks ?? [tpl('Set up laptop', 'it')];
  const calls: Call[] = [];
  const handler = async (sql: string, params?: unknown[]) => {
    if (/from hires/.test(sql) && /for update/.test(sql)) return { rows: hire ? [hire] : [] };
    if (/from onboarding_templates /.test(sql)) return { rows: template ? [template] : [] };
    if (/from onboarding_template_tasks/.test(sql)) return { rows: tasks };
    if (/insert into onboarding_plans /.test(sql)) {
      if (world.insertPlanError) throw world.insertPlanError;
      return { rows: [{ id: 'plan-1' }] };
    }
    if (/update hires/.test(sql)) return { rows: [], rowCount: hire ? 1 : 0 };
    if (/from onboarding_plan_tasks/.test(sql)) return { rows: world.planRows ?? [] };
    return { rows: [] };
  };
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params]);
      return handler(sql, params);
    }),
    release: jest.fn(),
  };
  const pool = {
    connect: jest.fn(async () => client),
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params]);
      return handler(sql, params);
    }),
  };
  const service = new HiresService({ pool } as unknown as DatabaseService);
  return { service, client, pool, calls };
}

const taskInsert = (calls: Call[]) => calls.find(([sql]) => /insert into onboarding_plan_tasks/.test(sql));
const assignees = (calls: Call[]) => taskInsert(calls)![1]![5] as string[];

describe('HiresService.createPlan', () => {
  it('copies every template task into the plan (AC1)', async () => {
    const tasks = [tpl('A', 'it'), tpl('B', 'hr', 1), tpl('C', 'new_hire', 14)];
    const { service, calls } = setup({ tasks });
    expect(await service.createPlan('hire-1')).toEqual({ ok: true, planId: 'plan-1' });
    const insert = taskInsert(calls)!;
    expect(insert[1]![2]).toHaveLength(tasks.length);
    expect(insert[1]![2]).toEqual(tasks.map((t) => t.title));
    expect(calls.some(([s]) => s === 'commit')).toBe(true);
  });

  it('assigns hiring-manager tasks to the manager on the hire record (AC3)', async () => {
    const { service, calls } = setup({ tasks: [tpl('Meet', 'hiring_manager', 1)] });
    await service.createPlan('hire-1');
    expect(assignees(calls)).toEqual(['Dana Lee']);
  });

  it('assigns IT tasks to IT (AC4)', async () => {
    const { service, calls } = setup({ tasks: [tpl('Laptop', 'it')] });
    await service.createPlan('hire-1');
    expect(assignees(calls)).toEqual(['IT']);
  });

  it('assigns new-hire tasks to the hire (AC9)', async () => {
    const { service, calls } = setup({ tasks: [tpl('Training', 'new_hire')] });
    await service.createPlan('hire-1');
    expect(assignees(calls)).toEqual(['Alex Morgan']);
  });

  it('assigns HR tasks to HR (AC10)', async () => {
    const { service, calls } = setup({ tasks: [tpl('Welcome', 'hr')] });
    await service.createPlan('hire-1');
    expect(assignees(calls)).toEqual(['HR']);
  });

  it('copies by value: no template task id, no stored due date (AC2, AC6)', async () => {
    const { service, calls } = setup();
    await service.createPlan('hire-1');
    const sql = taskInsert(calls)![0];
    expect(sql).toMatch(/title, owner, due_offset_days/);
    expect(sql).not.toMatch(/due_date/);
    expect(sql).not.toMatch(/template_task/);
  });

  it('refuses a hire with no manager when the template has a hiring-manager task (AC7)', async () => {
    const { service, client, calls } = setup({
      hire: { ...HIRE, manager_name: null },
      tasks: [tpl('Meet', 'hiring_manager', 1)],
    });
    expect(await service.createPlan('hire-1')).toEqual({ ok: false, code: 'no_manager' });
    expect(client.query).toHaveBeenCalledWith('rollback');
    expect(calls.filter(([s]) => /insert into/.test(s))).toHaveLength(0);
  });

  it('refuses a blank manager too (AC7)', async () => {
    const { service } = setup({ hire: { ...HIRE, manager_name: '  ' }, tasks: [tpl('Meet', 'hiring_manager')] });
    expect(await service.createPlan('hire-1')).toEqual({ ok: false, code: 'no_manager' });
  });

  it('creates the plan without a manager when no task needs one (AC7)', async () => {
    const { service } = setup({ hire: { ...HIRE, manager_name: null }, tasks: [tpl('Laptop', 'it')] });
    expect(await service.createPlan('hire-1')).toEqual({ ok: true, planId: 'plan-1' });
  });

  it('refuses a role with no template (AC8)', async () => {
    const { service, calls } = setup({ template: null });
    expect(await service.createPlan('hire-1')).toEqual({ ok: false, code: 'no_template' });
    expect(calls.filter(([s]) => /insert into/.test(s))).toHaveLength(0);
  });

  it('refuses a template with zero tasks (AC8)', async () => {
    const { service } = setup({ tasks: [] });
    expect(await service.createPlan('hire-1')).toEqual({ ok: false, code: 'no_template' });
  });

  it('checks the template before the manager', async () => {
    const { service } = setup({ hire: { ...HIRE, manager_name: null }, template: null });
    expect(await service.createPlan('hire-1')).toEqual({ ok: false, code: 'no_template' });
  });

  it('refuses an unknown hire', async () => {
    const { service } = setup({ hire: null });
    expect(await service.createPlan('nope')).toEqual({ ok: false, code: 'hire_not_found' });
  });

  it('refuses a second plan for the same hire', async () => {
    const { service } = setup({ hire: { ...HIRE, plan_id: 'plan-0' } });
    expect(await service.createPlan('hire-1')).toEqual({ ok: false, code: 'plan_exists' });
  });

  it('maps a unique violation on the hire index to plan_exists', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505', constraint: 'onboarding_plans_hire_uniq' });
    const { service } = setup({ insertPlanError: err });
    expect(await service.createPlan('hire-1')).toEqual({ ok: false, code: 'plan_exists' });
  });

  it('locks the hire row for the whole transaction', async () => {
    const { service, calls } = setup();
    await service.createPlan('hire-1');
    expect(calls[0][0]).toBe('begin');
    expect(calls.some(([s]) => /from hires[\s\S]*for update/.test(s))).toBe(true);
  });
});

describe('HiresService.getPlan', () => {
  const view = { id: 'plan-1', hire_name: 'Alex Morgan', job_role: 'software-engineer', start_date: '2026-12-01' };

  // The date arithmetic itself runs in Postgres and is not exercised by this mocked pool: this only checks
  // the row-to-view mapping and that the query adds the offset to the hire's start date.
  it('maps the plan rows and asks SQL for start date + offset (AC2)', async () => {
    const { service, pool } = setup({
      planRows: [{ ...view, title: 'Welcome', owner: 'hr', assignee: 'HR', due_offset_days: -30, due_date: '2026-11-01' }],
    });
    const plan = await service.getPlan('hire-1');
    expect(plan!.tasks[0]).toMatchObject({ dueOffsetDays: -30, dueDate: '2026-11-01', assignee: 'HR' });
    expect(plan).toMatchObject({ roleName: 'Software engineer', startDate: '2026-12-01', doneCount: 0 });
    expect(pool.query.mock.calls[0][0]).toContain('h.start_date + t.due_offset_days');
  });

  it('is null when the hire has no plan', async () => {
    const { service } = setup({ planRows: [] });
    expect(await service.getPlan('hire-1')).toBeNull();
  });
});

describe('HiresService.updateHire', () => {
  it('moves the start date without touching plan tasks (AC5)', async () => {
    const { service, calls } = setup();
    expect(await service.updateHire('hire-1', { startDate: '2026-12-08' })).toEqual({ ok: true });
    expect(calls.some(([s]) => /update hires set start_date = \$2/.test(s))).toBe(true);
    expect(calls.some(([s]) => /update onboarding_plan_tasks/.test(s))).toBe(false);
  });

  it('refuses a date that is not on the calendar (AC5)', async () => {
    const { service, calls } = setup();
    expect(await service.updateHire('hire-1', { startDate: '2026-02-31' })).toEqual({
      ok: false,
      code: 'invalid_start_date',
    });
    expect(calls).toHaveLength(0);
  });

  it('refuses an unknown manager', async () => {
    const { service } = setup();
    expect(await service.updateHire('hire-1', { managerName: 'Nobody' })).toEqual({
      ok: false,
      code: 'unknown_manager',
    });
  });

  it('refuses an unknown hire', async () => {
    const { service } = setup({ hire: null });
    expect(await service.updateHire('x', { startDate: '2026-12-08' })).toEqual({
      ok: false,
      code: 'hire_not_found',
    });
  });
});

describe('migration 005', () => {
  const sql = readFileSync(join(__dirname, '../../migrations/005_hires_and_plans.sql'), 'utf8');
  const sql004 = readFileSync(join(__dirname, '../../migrations/004_onboarding_templates.sql'), 'utf8');

  it('adds the columns and the unique index idempotently', () => {
    expect(sql).toMatch(/add column if not exists hire_id/);
    expect(sql).toMatch(/add column if not exists assignee/);
    expect(sql).toMatch(/add column if not exists status/);
    expect(sql).toMatch(/create unique index if not exists onboarding_plans_hire_uniq/);
  });

  it('adds no not-null column without a default to the existing plan tables', () => {
    const adds = sql.split(';').filter((s) => /alter table onboarding_plan/.test(s));
    for (const stmt of adds) if (/not null/.test(stmt)) expect(stmt).toMatch(/default/);
  });

  it('gives plan tasks no foreign key to template tasks (AC6)', () => {
    expect(sql).not.toMatch(/references onboarding_template_tasks/);
    expect(sql004).not.toMatch(/references onboarding_template_tasks/);
  });
});
