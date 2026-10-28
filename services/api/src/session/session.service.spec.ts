import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { SESSION_COOKIE, SessionService, readCookie } from './session.service';

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(readCookie('a=1; session=abc; b=2', 'session')).toBe('abc');
  });
  it('returns undefined when absent or no header', () => {
    expect(readCookie('a=1', 'session')).toBeUndefined();
    expect(readCookie(undefined, 'session')).toBeUndefined();
  });
});

describe('SessionService', () => {
  const pool = { query: jest.fn() };
  const service = new SessionService({ pool } as unknown as DatabaseService);
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('stores only the SHA-256 of the token and sets an HttpOnly Lax cookie', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await service.start(res as never, 'p1');
    const token = res.cookie.mock.calls[0][1] as string;
    expect(res.cookie.mock.calls[0][0]).toBe(SESSION_COOKIE);
    expect(res.cookie.mock.calls[0][2]).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    const params = pool.query.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(createHash('sha256').update(token).digest('hex'));
    expect(params[0]).not.toBe(token);
    expect(params[1]).toBe('p1');
  });

  it('resolves a cookie to its player and null without a cookie', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'p1', email: 'a@b.co' }] });
    expect(await service.resolve('session=tok')).toEqual({ id: 'p1', email: 'a@b.co' });
    expect(await service.resolve(undefined)).toBeNull();
  });

  it('end deletes the session row and clears the cookie', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await service.end('session=tok', res as never);
    expect(pool.query.mock.calls[0][0]).toMatch(/^delete from sessions/);
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.any(Object));
  });
});
