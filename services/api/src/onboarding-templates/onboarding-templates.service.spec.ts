import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '../database/database.service';
import { LATEST_DUE_DAY, OWNERS } from './onboarding-templates.constants';
import { OnboardingTemplatesService, TaskInput } from './onboarding-templates.service';

type Call = [string, unknown[] | undefined];

// By default an insert of a template returns an id and every other statement returns no rows.
const defaultHandler = (sql: string) =>
  sql.includes('insert into onboarding_templates') ? { rows: [{ id: 't1' }] } : { rows: [] };

function setup(handler: (sql: string, params?: unknown[]) => unknown = defaultHandler) {
  const calls: Call[] = [];
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
  const service = new OnboardingTemplatesService({ pool } as unknown as DatabaseService);
  return { service, calls, client, pool };
}

const sqlOf = (calls: Call[]) => calls.map(([sql]) => sql.trim());
const task = (
  title: string,
  owner: TaskInput['owner'],
  dueOffsetDays: TaskInput['dueOffsetDays'],
): TaskInput => ({ title, owner, dueOffsetDays });
const violation = () =>
  Object.assign(new Error('duplicate'), { code: '23505', constraint: 'onboarding_templates_role_uniq' });
const ROLE = 'software-engineer';

describe('OnboardingTemplatesService.save validation', () => {
  it('refuses an unknown role', async () => {
    const { service, pool } = setup();
    expect(await service.save('create', 'janitor', [task('A', 'it', 0)])).toEqual({
      ok: false,
      code: 'unknown_role',
    });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('refuses a template with no tasks and writes nothing (AC10)', async () => {
    const { service, pool } = setup();
    expect(await service.save('create', ROLE, [])).toEqual({ ok: false, code: 'no_tasks' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('refuses a task with no owner, naming the task (AC7)', async () => {
    const { service } = setup();
    const res = await service.save('create', ROLE, [task('A', 'it', 0), task('B', null, 3)]);
    expect(res).toEqual({ ok: false, code: 'owner_missing', taskIndex: 1 });
  });

  it('refuses an owner outside the four (AC3)', async () => {
    const { service } = setup();
    const res = await service.save('create', ROLE, [task('A', 'janitor' as never, 0)]);
    expect(res).toEqual({ ok: false, code: 'owner_missing', taskIndex: 0 });
  });

  it('refuses a missing title', async () => {
    const { service } = setup();
    expect(await service.save('create', ROLE, [task('  ', 'it', 0)])).toEqual({
      ok: false,
      code: 'title_missing',
      taskIndex: 0,
    });
  });

  it.each([null, 1.5, 'abc', Number.NaN])('refuses due date %p as missing (AC8)', async (due) => {
    const { service } = setup();
    const res = await service.save('create', ROLE, [task('A', 'it', due as never)]);
    expect(res).toEqual({ ok: false, code: 'due_missing', taskIndex: 0 });
  });

  it('refuses day 91 and accepts day 90 (AC9, AC5)', async () => {
    const { service } = setup();
    expect(await service.save('create', ROLE, [task('A', 'it', 91)])).toEqual({
      ok: false,
      code: 'due_too_late',
      taskIndex: 0,
    });
    expect(await service.save('create', ROLE, [task('A', 'it', 90)])).toEqual({ ok: true });
  });

  it('accepts any number of days before start (AC4)', async () => {
    const { service } = setup();
    expect(await service.save('create', ROLE, [task('A', 'it', -30), task('B', 'it', -400)])).toEqual({
      ok: true,
    });
  });
});

describe('OnboardingTemplatesService.save create', () => {
  it('inserts the template and its tasks in one transaction (AC1, AC3, AC4)', async () => {
    const { service, calls, client } = setup((sql) =>
      sql.includes('insert into onboarding_templates') ? { rows: [{ id: 't1' }] } : { rows: [] },
    );
    const res = await service.save('create', ROLE, [
      task(' Set up laptop ', 'it', -30),
      task('Review', 'hiring_manager', 90),
    ]);
    expect(res).toEqual({ ok: true });
    const sql = sqlOf(calls);
    expect(sql[0]).toBe('begin');
    expect(sql[1]).toMatch(/^insert into onboarding_templates/);
    expect(calls[1][1]).toEqual([ROLE]);
    expect(sql[2]).toMatch(/^insert into onboarding_template_tasks/);
    expect(calls[2][1]).toEqual([
      't1',
      [0, 1],
      ['Set up laptop', 'Review'],
      ['it', 'hiring_manager'],
      [-30, 90],
    ]);
    expect(sql[3]).toBe('commit');
    expect(client.release).toHaveBeenCalled();
  });

  it('maps the role unique index to role_exists and rolls back (AC11)', async () => {
    const { service, calls } = setup((sql) => {
      if (sql.includes('insert into onboarding_templates')) throw violation();
      return { rows: [] };
    });
    expect(await service.save('create', ROLE, [task('A', 'it', 0)])).toEqual({
      ok: false,
      code: 'role_exists',
    });
    expect(sqlOf(calls)).toContain('rollback');
    expect(sqlOf(calls)).not.toContain('commit');
  });

  it('only one of two parallel creates wins (AC11)', async () => {
    let taken = false;
    const { service } = setup((sql) => {
      if (sql.includes('insert into onboarding_templates')) {
        if (taken) throw violation();
        taken = true;
        return { rows: [{ id: 't1' }] };
      }
      return { rows: [] };
    });
    const results = await Promise.all([
      service.save('create', ROLE, [task('A', 'it', 0)]),
      service.save('create', ROLE, [task('A', 'it', 0)]),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('rolls back and rethrows any other error', async () => {
    const { service, calls } = setup((sql) => {
      if (sql.includes('insert into onboarding_templates')) return { rows: [{ id: 't1' }] };
      if (sql.includes('insert into onboarding_template_tasks')) throw new Error('boom');
      return { rows: [] };
    });
    await expect(service.save('create', ROLE, [task('A', 'it', 0)])).rejects.toThrow('boom');
    expect(sqlOf(calls)).toContain('rollback');
  });
});

describe('OnboardingTemplatesService.save edit', () => {
  it('locks the template, replaces its tasks and bumps updated_at (AC2)', async () => {
    const { service, calls } = setup((sql) =>
      sql.includes('for update') ? { rows: [{ id: 't1' }] } : { rows: [] },
    );
    const res = await service.save('edit', ROLE, [task('Set up laptop and badge', 'it', -3)]);
    expect(res).toEqual({ ok: true });
    const sql = sqlOf(calls);
    expect(sql[0]).toBe('begin');
    expect(sql[1]).toMatch(/for update$/);
    expect(sql[2]).toMatch(/^delete from onboarding_template_tasks where template_id = \$1/);
    expect(sql[3]).toMatch(/^insert into onboarding_template_tasks/);
    expect(calls[3][1]).toEqual(['t1', [0], ['Set up laptop and badge'], ['it'], [-3]]);
    expect(sql[4]).toMatch(/^update onboarding_templates set updated_at/);
    expect(sql[5]).toBe('commit');
  });

  it('never touches the hire plan tables (AC6)', async () => {
    const { service, calls } = setup((sql) =>
      sql.includes('for update') ? { rows: [{ id: 't1' }] } : { rows: [] },
    );
    await service.save('edit', ROLE, [task('Changed', 'hr', 45)]);
    expect(sqlOf(calls).filter((s) => /onboarding_plan/.test(s))).toEqual([]);
  });

  it('is not_found for a role with no template', async () => {
    const { service, calls } = setup();
    expect(await service.save('edit', ROLE, [task('A', 'it', 0)])).toEqual({
      ok: false,
      code: 'not_found',
    });
    expect(sqlOf(calls)).toContain('rollback');
  });
});

describe('OnboardingTemplatesService reads', () => {
  it('get returns tasks ordered by offset then position, with the plan count', async () => {
    const { service, calls } = setup((sql) => {
      if (sql.includes('from onboarding_templates t'))
        return { rows: [{ id: 't1', job_role: ROLE, plan_count: 14 }] };
      return { rows: [{ title: 'A', owner: 'it', due_offset_days: -3 }] };
    });
    expect(await service.get(ROLE)).toEqual({
      role: ROLE,
      name: 'Software engineer',
      planCount: 14,
      tasks: [{ title: 'A', owner: 'it', dueOffsetDays: -3 }],
    });
    expect(calls[1][0]).toMatch(/order by due_offset_days, position/);
  });

  it('get is null for an unknown template', async () => {
    expect(await setup().service.get(ROLE)).toBeNull();
  });

  it('list returns role, name and counts', async () => {
    const { service } = setup(() => ({
      rows: [{ job_role: ROLE, task_count: 5, plan_count: 14 }],
    }));
    expect(await service.list()).toEqual([
      { role: ROLE, name: 'Software engineer', taskCount: 5, planCount: 14 },
    ]);
  });

  it('roles is the fixed list of slugs and names', () => {
    expect(setup().service.roles()).toEqual([
      { role: 'software-engineer', name: 'Software engineer' },
      { role: 'customer-support-agent', name: 'Customer support agent' },
      { role: 'account-manager', name: 'Account manager' },
    ]);
  });
});

describe('due-date limit and owners', () => {
  it('are the same in the API, the SQL check constraints and the web app', () => {
    const sql = readFileSync(join(__dirname, '../../migrations/004_onboarding_templates.sql'), 'utf8');
    const web = readFileSync(
      join(__dirname, '../../../../apps/web/src/lib/onboardingTemplates.ts'),
      'utf8',
    );
    expect(sql).toContain(`due_offset_days <= ${LATEST_DUE_DAY}`);
    expect(web).toContain(`export const LATEST_DUE_DAY = ${LATEST_DUE_DAY};`);
    expect(sql).toContain(`owner in (${OWNERS.map((o) => `'${o}'`).join(', ')})`);
  });
});
