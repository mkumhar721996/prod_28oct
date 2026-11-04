import { DatabaseService } from '../database/database.service';
import { TransfersService } from './transfers.service';

type Call = [string, unknown[] | undefined];

function setup(accounts: Record<string, unknown>[]) {
  const calls: Call[] = [];
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params]);
      return sql.trim().startsWith('select') ? { rows: accounts } : { rows: [] };
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client) };
  const service = new TransfersService({ pool } as unknown as DatabaseService);
  return { service, calls };
}

const acc = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  player_id: 'p1',
  balance_credits: '100',
  frozen_at: null,
  ...over,
});
const sqls = (calls: Call[]) => calls.map(([sql]) => sql.trim().split(/\s+/)[0]);

describe('TransfersService.transfer', () => {
  it('AC4: refuses a transfer from a frozen account and moves nothing', async () => {
    const { service, calls } = setup([acc('a', { frozen_at: new Date() }), acc('b')]);
    expect(await service.transfer('p1', 'a', 'b', 10)).toEqual({ ok: false, reason: 'account_frozen' });
    expect(sqls(calls)).not.toContain('update');
    expect(sqls(calls)).toContain('rollback');
  });

  it('AC5: refuses a transfer to a frozen account and moves nothing', async () => {
    const { service, calls } = setup([acc('a'), acc('b', { frozen_at: new Date() })]);
    expect(await service.transfer('p1', 'a', 'b', 10)).toEqual({ ok: false, reason: 'account_frozen' });
    expect(sqls(calls)).not.toContain('update');
  });

  it('AC7: moves the money when neither account is frozen', async () => {
    const { service, calls } = setup([acc('a'), acc('b')]);
    expect(await service.transfer('p1', 'a', 'b', 10)).toEqual({ ok: true });
    expect(sqls(calls)).toEqual(['begin', 'select', 'update', 'update', 'commit']);
  });

  it('locks both rows in id order with for update', async () => {
    const { service, calls } = setup([acc('a'), acc('b')]);
    await service.transfer('p1', 'b', 'a', 10);
    expect(calls[1][0]).toMatch(/order by id for update/);
  });

  it('refuses a source the player does not own', async () => {
    const { service } = setup([acc('a', { player_id: 'other' }), acc('b')]);
    expect(await service.transfer('p1', 'a', 'b', 10)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('refuses more than the balance', async () => {
    const { service } = setup([acc('a'), acc('b')]);
    expect(await service.transfer('p1', 'a', 'b', 500)).toEqual({ ok: false, reason: 'insufficient_balance' });
  });

  it.each([0, -1, 1.5, '10', undefined])('refuses amount %p', async (amount) => {
    const { service } = setup([acc('a'), acc('b')]);
    expect(await service.transfer('p1', 'a', 'b', amount)).toEqual({ ok: false, reason: 'invalid_amount' });
  });

  it('refuses a transfer to the same account', async () => {
    const { service } = setup([acc('a')]);
    expect(await service.transfer('p1', 'a', 'a', 10)).toEqual({ ok: false, reason: 'same_account' });
  });
});
