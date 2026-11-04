import { DatabaseService } from '../database/database.service';
import { AccountsService } from './accounts.service';

type Call = [string, unknown[] | undefined];

function setup(handler: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [] })) {
  const calls: Call[] = [];
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params]);
      return handler(sql, params);
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client), query: jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] as unknown[] })),
  };
  const service = new AccountsService({ pool } as unknown as DatabaseService);
  return { service, calls, client, pool };
}

const sqlOf = (calls: Call[]) => calls.map(([sql]) => sql.trim().split(/\s+/).slice(0, 2).join(' '));

const row = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  number: 'ACC-0001',
  email: 'jo@example.com',
  balance_credits: '100',
  frozen_at: null,
  frozen_by_email: null,
  freeze_reason: null,
  ...over,
});

describe('AccountsService.freeze', () => {
  it.each([undefined, null, 42, '', '   '])('AC1: refuses reason %p before touching the database', async (reason) => {
    const { service, pool } = setup();
    expect(await service.freeze('a1', 's1', reason)).toEqual({ ok: false, reason: 'reason_required' });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('AC2: freezes with the trimmed reason and records the event in one transaction', async () => {
    const { service, calls } = setup((sql) => {
      if (sql.trim().startsWith('update accounts')) return { rows: [{ id: 'a1' }] };
      if (sql.trim().startsWith('select')) {
        return { rows: [row({ frozen_at: new Date('2026-11-04T10:00:00Z'), freeze_reason: 'Fraud' })] };
      }
      return { rows: [] };
    });
    const res = await service.freeze('a1', 's1', '  Fraud ');
    expect(res).toMatchObject({ ok: true, account: { frozen: true, freezeReason: 'Fraud' } });
    const update = calls.find(([sql]) => sql.trim().startsWith('update accounts'));
    expect(update?.[1]).toEqual(['a1', 's1', 'Fraud']);
    expect(sqlOf(calls)).toEqual(['begin', 'update accounts', 'insert into', 'select a.id,', 'commit']);
  });

  it('refuses an account that is already frozen without writing an event', async () => {
    const { service, calls } = setup((sql) =>
      sql.trim().startsWith('select') ? { rows: [row({ frozen_at: new Date(), freeze_reason: 'x' })] } : { rows: [] },
    );
    expect(await service.freeze('a1', 's1', 'Fraud')).toEqual({ ok: false, reason: 'already_frozen' });
    expect(sqlOf(calls)).not.toContain('insert into');
    expect(sqlOf(calls)).toContain('rollback');
  });

  it('refuses an unknown account', async () => {
    const { service } = setup();
    expect(await service.freeze('nope', 's1', 'Fraud')).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('AccountsService.unfreeze', () => {
  it('AC3: clears the freeze for any staff member with no reason and records the event', async () => {
    const { service, calls } = setup((sql) => {
      if (sql.trim().startsWith('update accounts')) return { rows: [{ id: 'a1' }] };
      if (sql.trim().startsWith('select')) return { rows: [row()] };
      return { rows: [] };
    });
    const res = await service.unfreeze('a1', 's2');
    expect(res).toMatchObject({ ok: true, account: { frozen: false } });
    const update = calls.find(([sql]) => sql.trim().startsWith('update accounts'));
    expect(update?.[0]).toMatch(/frozen_at = null/);
    expect(sqlOf(calls)).toContain('insert into');
  });
});

describe('AccountsService.search', () => {
  it('matches email or account number with a capped list', async () => {
    const { service, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [row()] });
    const found = await service.search('jo');
    expect(found).toHaveLength(1);
    const [sql, params] = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/limit/);
    expect(params[0]).toBe('%jo%');
  });
});
