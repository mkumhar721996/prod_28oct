import { DatabaseService } from '../database/database.service';
import { canBet } from './wallet.constants';
import { WalletService } from './wallet.service';

type Call = [string, unknown[] | undefined];

function setup(
  handler: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [] }),
  env: Record<string, string> = {},
) {
  const calls: Call[] = [];
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params]);
      return handler(sql, params);
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client), query: jest.fn() };
  const saved = process.env.WALLET_TOP_UP_CREDITS;
  if (env.WALLET_TOP_UP_CREDITS === undefined) delete process.env.WALLET_TOP_UP_CREDITS;
  else process.env.WALLET_TOP_UP_CREDITS = env.WALLET_TOP_UP_CREDITS;
  const service = new WalletService({ pool } as unknown as DatabaseService);
  if (saved === undefined) delete process.env.WALLET_TOP_UP_CREDITS;
  else process.env.WALLET_TOP_UP_CREDITS = saved;
  return { service, calls, client, pool };
}

const sqlOf = (calls: Call[]) => calls.map(([sql]) => sql.trim());
const updated = (balance: number) => (sql: string) =>
  sql.trim().startsWith('update wallets') ? { rows: [{ balance_credits: String(balance) }] } : { rows: [] };

describe('canBet', () => {
  it('needs a balance strictly above the minimum bet', () => {
    expect(canBet(1)).toBe(false);
    expect(canBet(2)).toBe(true);
  });
});

describe('WalletService.placeBet', () => {
  it('AC1: debits and writes a ledger row in one transaction', async () => {
    const { service, calls } = setup(updated(400));
    expect(await service.placeBet('p1', 100)).toEqual({ ok: true, balanceCredits: 400 });
    expect(sqlOf(calls)).toEqual([
      'begin',
      expect.stringMatching(/^update wallets/),
      expect.stringMatching(/^insert into wallet_entries/),
      'commit',
    ]);
    expect(calls[2][1]).toEqual(['p1', 'bet', 100, 400]);
  });

  it('checks and changes in one statement with the balance > bet predicate', async () => {
    const { service, calls } = setup(updated(400));
    await service.placeBet('p1', 100);
    expect(calls[1][0]).toMatch(/balance_credits > \$2/);
    expect(calls[1][0]).toMatch(/balance_credits - \$2/);
  });

  it('AC4/AC7: accepts a bet that leaves 1 credit', async () => {
    const { service } = setup(updated(1));
    expect(await service.placeBet('p1', 9)).toEqual({ ok: true, balanceCredits: 1 });
  });

  it('AC5/8/9: refuses when the update matches no row, writing nothing', async () => {
    const { service, calls } = setup();
    expect(await service.placeBet('p1', 10)).toEqual({ ok: false, reason: 'insufficient_balance' });
    expect(sqlOf(calls).some((s) => s.startsWith('insert into wallet_entries'))).toBe(false);
    expect(sqlOf(calls)).toContain('rollback');
  });

  it.each([0, -1, 1.5, 'abc', NaN, Infinity, '5'])(
    'AC6/16/17: refuses %p before any SQL runs',
    async (amount) => {
      const { service, pool } = setup();
      expect(await service.placeBet('p1', amount)).toEqual({ ok: false, reason: 'invalid_amount' });
      expect(pool.connect).not.toHaveBeenCalled();
    },
  );

  it('rolls back and rethrows when the ledger insert fails', async () => {
    const { service, calls, client } = setup((sql) => {
      if (sql.startsWith('insert into wallet_entries')) throw new Error('boom');
      return updated(400)(sql);
    });
    await expect(service.placeBet('p1', 100)).rejects.toThrow('boom');
    expect(sqlOf(calls)).toContain('rollback');
    expect(sqlOf(calls)).not.toContain('commit');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('WalletService.recordWin', () => {
  it('AC2: credits the wallet and writes a win entry', async () => {
    const { service, calls } = setup(updated(650));
    expect(await service.recordWin('p1', 250)).toEqual({ ok: true, balanceCredits: 650 });
    expect(calls[2][1]).toEqual(['p1', 'win', 250, 650]);
  });

  it('refuses an invalid amount', async () => {
    const { service } = setup();
    expect(await service.recordWin('p1', 0)).toEqual({ ok: false, reason: 'invalid_amount' });
  });
});

describe('WalletService.claimTopUp', () => {
  it('AC10: adds the default amount when the balance is 1 or less', async () => {
    const { service, calls } = setup(updated(501));
    expect(await service.claimTopUp('p1')).toEqual({ ok: true, balanceCredits: 501 });
    expect(calls[1][0]).toMatch(/balance_credits <= 1/);
    expect(calls[2][1]).toEqual(['p1', 'topup', 500, 501]);
  });

  it('refuses when the balance is not low', async () => {
    const { service } = setup();
    expect(await service.claimTopUp('p1')).toEqual({ ok: false, reason: 'balance_not_low' });
  });

  it('uses WALLET_TOP_UP_CREDITS', async () => {
    const { service, calls } = setup(updated(751), { WALLET_TOP_UP_CREDITS: '750' });
    expect(await service.claimTopUp('p1')).toEqual({ ok: true, balanceCredits: 751 });
    expect(calls[1][1]).toEqual(['p1', 750]);
  });

  it('falls back to 500 for a bad setting without throwing', async () => {
    const { service } = setup(updated(501), { WALLET_TOP_UP_CREDITS: 'abc' });
    expect(service.topUpCredits).toBe(500);
    expect(await service.claimTopUp('p1')).toEqual({ ok: true, balanceCredits: 501 });
  });
});

describe('WalletService.historyFor', () => {
  const NOW = new Date('2026-10-28T12:00:00Z');

  it('filters the recent window inclusively and pages 10 at a time', async () => {
    const { service, pool } = setup();
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: '24' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '5',
            kind: 'bet',
            amount_credits: '100',
            balance_after_credits: '400',
            created_at: new Date('2026-10-27T00:00:00Z'),
          },
        ],
      });
    const h = await service.historyFor('p1', { page: 2, range: 'recent' }, NOW);
    expect(pool.query.mock.calls[0][0]).toMatch(/created_at >= \$2/);
    expect(pool.query.mock.calls[1][1]).toEqual(['p1', new Date('2026-09-28T12:00:00Z'), 10, 10]);
    expect(h).toEqual({
      entries: [
        {
          id: '5',
          kind: 'bet',
          amountCredits: 100,
          balanceCredits: 400,
          createdAt: '2026-10-27T00:00:00.000Z',
        },
      ],
      page: 2,
      pageCount: 3,
      total: 24,
      range: 'recent',
    });
  });

  it('has no date filter for range=all', async () => {
    const { service, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [{ total: '0' }] }).mockResolvedValueOnce({ rows: [] });
    const h = await service.historyFor('p1', { page: 1, range: 'all' }, NOW);
    expect(pool.query.mock.calls[0][0]).not.toMatch(/created_at >=/);
    expect(h.pageCount).toBe(1);
  });

  it('orders by id only, so the list follows the balance chain', async () => {
    const { service, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [{ total: '0' }] }).mockResolvedValueOnce({ rows: [] });
    await service.historyFor('p1', { page: 1, range: 'all' }, NOW);
    expect(pool.query.mock.calls[1][0]).toMatch(/order by id desc/);
    expect(pool.query.mock.calls[1][0]).not.toMatch(/order by created_at/);
  });

  it('stamps the ledger row with the insert time, not the transaction start', async () => {
    const { service, calls } = setup(updated(400));
    await service.placeBet('p1', 100);
    expect(calls[2][0]).toMatch(/clock_timestamp\(\)/);
  });
});
