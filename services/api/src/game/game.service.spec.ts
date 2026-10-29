import { DatabaseService } from '../database/database.service';
import { GameService } from './game.service';

type Call = [string, unknown[] | undefined];

const POOL_ROW = { mini_cents: '200', minor_cents: '150', major_cents: '100', grand_cents: '50' };

function setup(handler: (sql: string, params?: unknown[]) => unknown) {
  const calls: Call[] = [];
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params]);
      return handler(sql.trim(), params);
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client), query: jest.fn(async () => ({ rows: [] as unknown[] })) };
  const service = new GameService({ pool } as unknown as DatabaseService);
  return { service, calls, client, pool };
}

const sqlOf = (calls: Call[]) => calls.map(([sql]) => sql.trim());

/** Wallet starts at `start`; the debit returns start - bet, the credit returns that plus the win. */
function wallet(start: number, bet: number, win = 0) {
  let wallets = 0;
  return (sql: string) => {
    if (sql.startsWith('update wallets')) {
      wallets += 1;
      return { rows: [{ balance_credits: String(wallets === 1 ? start - bet : start - bet + win) }] };
    }
    if (sql.startsWith('update jackpot_pool')) return { rows: [POOL_ROW] };
    return { rows: [] };
  };
}

// Index 0 is cherry, 2 is bar: [cherry, bar, bar] loses; [cherry, cherry, bar] wins 1x.
const losing = (() => {
  const seq = [0, 2, 2];
  let i = 0;
  return () => seq[i++ % 3];
})();
const winning = (() => {
  const seq = [0, 0, 2];
  let i = 0;
  return () => seq[i++ % 3];
})();

describe('GameService.spin', () => {
  it('AC5: a loss debits the bet only', async () => {
    const { service, calls } = setup(wallet(1000, 100));
    expect(await service.spin('p1', 100, losing)).toMatchObject({
      ok: true,
      winCredits: 0,
      balanceCredits: 900,
    });
    expect(sqlOf(calls)).toEqual([
      'begin',
      expect.stringMatching(/^update wallets/),
      expect.stringMatching(/^insert into wallet_entries/),
      expect.stringMatching(/^update jackpot_pool/),
      expect.stringMatching(/^insert into spins/),
      'commit',
    ]);
  });

  it('AC5: a win credits the wallet and writes a win ledger row', async () => {
    const { service, calls } = setup(wallet(1000, 100, 100));
    const result = await service.spin('p1', 100, winning);
    expect(result).toMatchObject({ ok: true, winCredits: 100, balanceCredits: 1000 });
    expect(sqlOf(calls)).toEqual([
      'begin',
      expect.stringMatching(/^update wallets/),
      expect.stringMatching(/^insert into wallet_entries/),
      expect.stringMatching(/^update wallets/),
      expect.stringMatching(/^insert into wallet_entries/),
      expect.stringMatching(/^update jackpot_pool/),
      expect.stringMatching(/^insert into spins/),
      'commit',
    ]);
    expect(calls[2][1]).toEqual(['p1', 'bet', 100, 900]);
    expect(calls[4][1]).toEqual(['p1', 'win', 100, 1000]);
  });

  it('AC7: adds the split contribution to the pool', async () => {
    const { service, calls } = setup(wallet(1000, 100));
    await service.spin('p1', 100, losing);
    expect(calls[3][1]).toEqual([200, 150, 100, 50]);
  });

  it('AC11: a bet of 25 contributes 50, 38, 25 and 13 cents', async () => {
    const { service, calls } = setup(wallet(1000, 25));
    await service.spin('p1', 25, losing);
    expect(calls[3][1]).toEqual([50, 38, 25, 13]);
  });

  it('returns the pool in cents with the total', async () => {
    const { service } = setup(wallet(1000, 100));
    expect(await service.spin('p1', 100, losing)).toMatchObject({
      jackpot: { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 },
    });
  });

  it('AC9: a balance that does not cover the bet rolls back and spins nothing', async () => {
    const { service, calls } = setup(() => ({ rows: [] }));
    expect(await service.spin('p1', 100, losing)).toMatchObject({
      ok: false,
      reason: 'insufficient_balance',
    });
    expect(sqlOf(calls)).toContain('rollback');
    expect(sqlOf(calls).some((s) => s.startsWith('insert into spins'))).toBe(false);
  });

  it('a balance equal to the bet may be wagered', async () => {
    const { service, calls } = setup(wallet(100, 100));
    expect(await service.spin('p1', 100, losing)).toMatchObject({ ok: true, balanceCredits: 0 });
    expect(calls[1][0]).toMatch(/balance_credits >= \$2/);
  });

  it('AC8: rolls back, never committing, when the pool update fails', async () => {
    const base = wallet(1000, 100);
    const { service, calls } = setup((sql) => {
      if (sql.startsWith('update jackpot_pool')) throw new Error('boom');
      return base(sql);
    });
    await expect(service.spin('p1', 100, losing)).rejects.toThrow('boom');
    expect(sqlOf(calls).at(-1)).toBe('rollback');
    expect(sqlOf(calls)).not.toContain('commit');
  });

  it.each([0, 7, '100', null, undefined, 100.5])('refuses %p before any SQL runs', async (bet) => {
    const { service, pool } = setup(() => ({ rows: [] }));
    expect(await service.spin('p1', bet, losing)).toEqual({ ok: false, reason: 'invalid_bet' });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('GameService.stateFor', () => {
  it('returns the balance and the pool tiers', async () => {
    const { service, pool } = setup(() => ({ rows: [] }));
    pool.query
      .mockResolvedValueOnce({ rows: [{ balance_credits: '1000' }] })
      .mockResolvedValueOnce({ rows: [POOL_ROW] });
    expect(await service.stateFor('p1')).toEqual({
      balanceCredits: 1000,
      jackpot: { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 },
    });
  });
});
