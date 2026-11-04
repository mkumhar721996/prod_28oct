import { DatabaseService } from '../database/database.service';
import { TransfersService } from './transfers.service';

type Row = Record<string, unknown>;
type Call = [string, unknown[] | undefined];

const CHECKING = '11111111-1111-4111-8111-111111111111';
const SAVINGS = '22222222-2222-4222-8222-222222222222';
const OTHERS = '33333333-3333-4333-8333-333333333333';

/** A tiny in-memory stand-in for the three tables, answering the SQL the service sends. */
function setup({
  checking = 200,
  savings = 100,
  frozen = [] as string[],
  failAudit = false,
}: { checking?: number; savings?: number; frozen?: string[]; failAudit?: boolean } = {}) {
  const calls: Call[] = [];
  const balances: Record<string, number> = { [CHECKING]: checking, [SAVINGS]: savings };
  const transfers = new Map<string, Row>();
  const audits: Row[] = [];
  let snapshot = { ...balances };
  const client = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push([sql, params]);
      const s = sql.trim();
      if (s === 'begin') snapshot = { ...balances };
      if (s === 'rollback') Object.assign(balances, snapshot);
      if (s.startsWith('insert into transfers')) {
        const key = String(params[4]);
        if (transfers.has(key)) return { rows: [] };
        transfers.set(key, { from: params[1], to: params[2], amount: params[3] });
        return { rows: [{ id: 't1' }] };
      }
      if (s.startsWith('select a.id, a.balance') && s.includes('transfers')) {
        const t = transfers.get(String(params[1]));
        if (!t) return { rows: [] };
        const row = (id: unknown) => ({
          id,
          balance: String(balances[id as string]),
          transfer_id: 't1',
          from_account_id: t.from,
        });
        return { rows: [row(t.from), row(t.to)] };
      }
      if (s.startsWith('select id, balance')) {
        const ids = (params[0] as string[]).filter((id) => id in balances).sort();
        return {
          rows: ids.map((id) => ({
            id,
            balance: String(balances[id]),
            frozen: frozen.includes(id),
          })),
        };
      }
      if (s.startsWith('update accounts')) balances[params[1] as string] += Number(params[0]);
      if (s.startsWith('insert into audit_records')) {
        if (failAudit) throw new Error('audit failed');
        audits.push({ kind: params[0], details: JSON.parse(String(params[3])) });
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client), query: jest.fn() };
  const service = new TransfersService({ pool } as unknown as DatabaseService);
  return { service, calls, balances, audits, transfers };
}

const input = (over: Row = {}) => ({
  fromAccountId: CHECKING,
  toAccountId: SAVINGS,
  amount: 50,
  idempotencyKey: 'k1',
  ...over,
});

describe('TransfersService.execute', () => {
  it('AC3/AC4: moves the amount and returns both new balances', async () => {
    const { service, balances } = setup();
    const r = await service.execute('p1', input());
    expect(r).toMatchObject({
      ok: true,
      replayed: false,
      from: { id: CHECKING, balance: 150 },
      to: { id: SAVINGS, balance: 150 },
    });
    expect(balances).toEqual({ [CHECKING]: 150, [SAVINGS]: 150 });
  });

  it('AC5: refuses an amount above the source balance', async () => {
    const { service } = setup({ checking: 100 });
    expect(await service.execute('p1', input({ amount: 150 }))).toEqual({
      ok: false,
      reason: 'insufficient_balance',
    });
  });

  it.each([
    ['AC5 amount above balance', {}, { amount: 250 }, 'insufficient_balance'],
    ['AC7 frozen source', { frozen: [CHECKING] }, {}, 'source_frozen'],
    ['AC8 frozen destination', { frozen: [SAVINGS] }, {}, 'destination_frozen'],
  ])('AC6: %s leaves balances, transfers and audit unchanged', async (_n, opts, over, reason) => {
    const { service, balances, audits, transfers } = setup(opts);
    expect(await service.execute('p1', input(over))).toEqual({ ok: false, reason });
    expect(balances).toEqual({ [CHECKING]: 200, [SAVINGS]: 100 });
    expect(audits).toHaveLength(0);
    expect(transfers.size).toBe(0); // refused before the transfers row is inserted
  });

  it('refuses before moving any money: rolls back and never updates', async () => {
    const { service, calls } = setup({ frozen: [CHECKING] });
    await service.execute('p1', input());
    const sql = calls.map(([s]) => s.trim());
    expect(sql).toContain('rollback');
    expect(sql).not.toContain('commit');
    expect(sql.some((s) => s.startsWith('update accounts'))).toBe(false);
  });

  it('is not_found for an account that is not the player’s', async () => {
    const { service } = setup();
    expect(await service.execute('p1', input({ toAccountId: OTHERS }))).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('is not_found for a malformed account id, without touching the database', async () => {
    const { service, calls } = setup();
    expect(await service.execute('p1', input({ toAccountId: 'not-a-uuid' }))).toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(await service.execute('p1', input({ fromAccountId: 7 }))).toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(calls).toHaveLength(0);
  });

  it('refuses the same account and a bad amount or key without touching the database', async () => {
    const { service, calls } = setup();
    expect(await service.execute('p1', input({ toAccountId: CHECKING }))).toEqual({
      ok: false,
      reason: 'same_account',
    });
    for (const amount of [0, -5, 1.5, '50', null]) {
      expect(await service.execute('p1', input({ amount }))).toEqual({
        ok: false,
        reason: 'invalid_amount',
      });
    }
    for (const idempotencyKey of ['', 7, 'x'.repeat(101)]) {
      expect(await service.execute('p1', input({ idempotencyKey }))).toEqual({
        ok: false,
        reason: 'invalid_amount',
      });
    }
    expect(calls).toHaveLength(0);
  });

  it('AC10/AC11: the same confirmation twice applies once and replays the outcome', async () => {
    const { service, balances } = setup();
    await service.execute('p1', input());
    const second = await service.execute('p1', input());
    expect(second).toMatchObject({
      ok: true,
      replayed: true,
      from: { balance: 150 },
      to: { balance: 150 },
    });
    expect(balances).toEqual({ [CHECKING]: 150, [SAVINGS]: 150 });
  });

  it('locks both accounts in id order, before the transfers insert', async () => {
    const { service, calls } = setup();
    await service.execute('p1', input());
    const sql = calls.map(([s]) => s.trim());
    const insert = sql.findIndex((s) => s.startsWith('insert into transfers'));
    const lock = sql.findIndex((s) => s.startsWith('select id, balance'));
    expect(lock).toBeGreaterThan(0);
    expect(insert).toBeGreaterThan(lock);
    expect(sql[lock]).toMatch(/order by id for update/);
  });

  it('AC12: writes one audit record for the completed transfer', async () => {
    const { service, audits } = setup();
    await service.execute('p1', input());
    expect(audits).toEqual([
      {
        kind: 'transfer.completed',
        details: { from: CHECKING, to: SAVINGS, amount: 50 },
      },
    ]);
    await service.execute('p1', input());
    expect(audits).toHaveLength(1);
  });

  it('rolls everything back when the audit insert fails', async () => {
    const { service, balances, calls } = setup({ failAudit: true });
    await expect(service.execute('p1', input())).rejects.toThrow('audit failed');
    expect(balances).toEqual({ [CHECKING]: 200, [SAVINGS]: 100 });
    expect(calls.map(([s]) => s.trim())).toContain('rollback');
  });
});
