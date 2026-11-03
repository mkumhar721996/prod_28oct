import { DatabaseService } from '../database/database.service';
import { GameService } from './game.service';

type Call = [string, unknown[] | undefined];

const POOL_ROW = { mini_cents: '200', minor_cents: '150', major_cents: '100', grand_cents: '50' };

/** Wallet updates answer with `balances` in order; `null` means no row matched. */
function setup(balances: (number | null)[], fail?: (sql: string) => boolean) {
  const calls: Call[] = [];
  const queue = [...balances];
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params]);
      if (fail?.(sql.trim())) throw new Error('boom');
      if (sql.trim().startsWith('update wallets')) {
        const next = queue.shift();
        return { rows: next === null || next === undefined ? [] : [{ balance_credits: String(next) }] };
      }
      if (sql.trim().startsWith('update jackpot_pool')) return { rows: [POOL_ROW] };
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client), query: jest.fn() };
  const service = new GameService({ pool } as unknown as DatabaseService);
  return { service, calls, client, pool };
}

const sqlOf = (calls: Call[]) => calls.map(([sql]) => sql.trim());
// randomInt(4) -> index into ['cherry', 'bell', 'bar', 'seven']
const losing = () => 2; // bar bar bar
let n = 0;
const twoCherries = () => [0, 0, 2][n++ % 3]; // cherry cherry bar

describe('GameService.spin', () => {
  beforeEach(() => {
    n = 0;
  });

  it('AC5: a loss leaves balance minus bet', async () => {
    const { service, calls } = setup([900]);
    expect(await service.spin('p1', 100, losing)).toMatchObject({
      ok: true,
      reels: ['bar', 'bar', 'bar'],
      winCredits: 0,
      label: null,
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

  it('AC5: a win leaves balance minus bet plus the win, with a win ledger row', async () => {
    const { service, calls } = setup([900, 1000]);
    const result = await service.spin('p1', 100, twoCherries);
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

  it('debits with the balance >= bet predicate in SQL', async () => {
    const { service, calls } = setup([900]);
    await service.spin('p1', 100, losing);
    expect(calls[1][0]).toMatch(/balance_credits >= \$2/);
    expect(calls[1][1]).toEqual(['p1', 100]);
  });

  it('AC6/AC7: adds the split contribution to the pool in cents', async () => {
    const { service, calls } = setup([900]);
    const result = await service.spin('p1', 100, losing);
    expect(calls[3][1]).toEqual([200, 150, 100, 50]);
    expect(result).toMatchObject({
      jackpot: { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 },
    });
  });

  it('AC11: a bet of 25 adds 50, 38, 25 and 13 cents', async () => {
    const { service, calls } = setup([975]);
    await service.spin('p1', 25, losing);
    expect(calls[3][1]).toEqual([50, 38, 25, 13]);
  });

  it('AC9/AC10: refuses without a matching wallet row, drawing and writing nothing', async () => {
    const rng = jest.fn(() => 0);
    const { service, calls } = setup([null]);
    expect(await service.spin('p1', 250, rng)).toEqual({ ok: false, reason: 'insufficient_balance' });
    expect(rng).not.toHaveBeenCalled();
    expect(sqlOf(calls)).toContain('rollback');
    expect(sqlOf(calls).some((s) => s.startsWith('insert into'))).toBe(false);
    expect(sqlOf(calls)).not.toContain('commit');
  });

  it('AC10: a refusal reports the balance so the message can name it', async () => {
    const { service, client } = setup([null]);
    client.query.mockImplementation(async (sql: string) =>
      sql.trim().startsWith('select balance_credits') ? { rows: [{ balance_credits: '100' }] } : { rows: [] },
    );
    expect(await service.spin('p1', 250, losing)).toEqual({
      ok: false,
      reason: 'insufficient_balance',
      balanceCredits: 100,
    });
  });

  it.each([0, 7, '100', null, undefined, 100.5])('refuses the bet %p before any SQL runs', async (bet) => {
    const { service, pool } = setup([900]);
    expect(await service.spin('p1', bet, losing)).toEqual({ ok: false, reason: 'invalid_bet' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('AC8: rolls back, never commits and rethrows when the pool update fails', async () => {
    const { service, calls, client } = setup([900], (sql) => sql.startsWith('update jackpot_pool'));
    await expect(service.spin('p1', 100, losing)).rejects.toThrow('boom');
    expect(sqlOf(calls).at(-1)).toBe('rollback');
    expect(sqlOf(calls)).not.toContain('commit');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('GameService.stateFor', () => {
  it('returns the balance and the pool tiers', async () => {
    const { service, pool } = setup([]);
    pool.query
      .mockResolvedValueOnce({ rows: [{ balance_credits: '1000' }] })
      .mockResolvedValueOnce({ rows: [POOL_ROW] });
    expect(await service.stateFor('p1')).toEqual({
      balanceCredits: 1000,
      jackpot: { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 },
    });
  });
});
