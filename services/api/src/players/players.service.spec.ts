import { BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { STARTING_GRANT } from './players.constants';
import { PasswordService } from './password.service';
import { PlayersService } from './players.service';

function setup(handler: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [] })) {
  const calls: Array<[string, unknown[] | undefined]> = [];
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push([sql, params]);
      return handler(sql, params);
    }),
    release: jest.fn(),
  };
  const pool = {
    connect: jest.fn(async () => client),
    query: jest.fn(async (sql: string, params?: unknown[]) => handler(sql, params)),
  };
  const passwords = new PasswordService();
  const service = new PlayersService({ pool } as unknown as DatabaseService, passwords);
  return { service, passwords, client, pool, calls };
}

const sqlOf = (calls: Array<[string, unknown[] | undefined]>) => calls.map(([sql]) => sql.trim());

describe('PlayersService.register', () => {
  it('inserts the player and the starting grant in one transaction', async () => {
    const { service, calls, client } = setup((sql) =>
      sql.includes('insert into players')
        ? { rows: [{ id: 'p1', email: 'ana@example.com' }] }
        : { rows: [] },
    );
    const player = await service.register(' ANA@example.com ', 'play-2026');
    expect(player).toEqual({ id: 'p1', email: 'ana@example.com' });
    const sql = sqlOf(calls);
    expect(sql[0]).toBe('begin');
    expect(sql[1]).toMatch(/^insert into players/);
    expect(sql[2]).toMatch(/^insert into wallets/);
    expect(calls[2][1]).toEqual(['p1', STARTING_GRANT]);
    expect(sql[3]).toBe('commit');
    expect(calls[1][1]![0]).toBe('ana@example.com');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back when the wallet insert throws', async () => {
    const { service, calls } = setup((sql) => {
      if (sql.includes('insert into players')) return { rows: [{ id: 'p1', email: 'a@b.co' }] };
      if (sql.includes('insert into wallets')) throw new Error('boom');
      return { rows: [] };
    });
    await expect(service.register('a@b.co', 'play-2026')).rejects.toThrow('boom');
    expect(sqlOf(calls)).toContain('rollback');
    expect(sqlOf(calls)).not.toContain('commit');
  });

  it('maps a unique violation to a conflict', async () => {
    const { service } = setup((sql) => {
      if (sql.includes('insert into players')) throw Object.assign(new Error('dup'), { code: '23505' });
      return { rows: [] };
    });
    await expect(service.register('a@b.co', 'play-2026')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a bad email or short password without touching the database', async () => {
    const { service, pool } = setup();
    await expect(service.register('nope', 'play-2026')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.register('a@b.co', 'short')).rejects.toBeInstanceOf(BadRequestException);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('PlayersService.authenticate', () => {
  it('returns the player for the right password and never touches wallets', async () => {
    const { service, passwords, pool } = setup();
    const hash = await passwords.hash('play-2026');
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', email: 'a@b.co', password_hash: hash }] });
    expect(await service.authenticate(' A@B.co', 'play-2026')).toEqual({ id: 'p1', email: 'a@b.co' });
    expect(pool.query.mock.calls[0][0]).not.toMatch(/wallets/);
  });

  it('returns null for a wrong password', async () => {
    const { service, passwords, pool } = setup();
    const hash = await passwords.hash('play-2026');
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', email: 'a@b.co', password_hash: hash }] });
    expect(await service.authenticate('a@b.co', 'wrong-wrong')).toBeNull();
  });

  it('returns null for an unknown email after a dummy hash compare', async () => {
    const { service, passwords } = setup();
    const verify = jest.spyOn(passwords, 'verify');
    expect(await service.authenticate('nobody@b.co', 'play-2026')).toBeNull();
    expect(verify).toHaveBeenCalledTimes(1);
  });
});
