import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { hashToken } from '../session/session.service';
import { STAFF_IDLE_MS, STAFF_SESSION_COOKIE } from './staff.constants';
import { StaffSessionService } from './staff-session.service';

const T0 = new Date('2026-01-01T09:00:00Z').getTime();
const staff = { id: 's1', email: 'a@bank.example' };

/** A pool that applies the cutoff passed as $2, like the real statement. */
function setup() {
  let lastActivity = T0;
  const pool = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('update staff_sessions')) {
        if (lastActivity > (params[1] as Date).getTime()) {
          lastActivity = Date.now();
          return { rows: [staff] };
        }
        return { rows: [] };
      }
      if (sql.startsWith('select 1')) return { rows: [{ '?column?': 1 }] };
      return { rows: [] };
    }),
  };
  const service = new StaffSessionService({ pool } as unknown as DatabaseService);
  return { pool, service };
}

describe('StaffSessionService.resolve', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('refuses a session idle for exactly 15 minutes', async () => {
    const { pool, service } = setup();
    jest.setSystemTime(T0 + STAFF_IDLE_MS);
    expect(await service.resolve('staff_session=tok')).toEqual({ ok: false, reason: 'expired' });
    expect((pool.query.mock.calls[0][1][1] as Date).getTime()).toBe(T0);
  });

  it('opens for a session idle for 14 minutes and slides the window', async () => {
    const { pool, service } = setup();
    jest.setSystemTime(T0 + 14 * 60 * 1000);
    expect(await service.resolve('staff_session=tok')).toEqual({ ok: true, staff });
    expect(pool.query.mock.calls[0][0]).toContain('set last_activity_at = now()');
    jest.setSystemTime(T0 + 28 * 60 * 1000);
    expect(await service.resolve('staff_session=tok')).toEqual({ ok: true, staff });
  });

  it('is signed-out without a staff cookie or for an unknown token', async () => {
    const { pool, service } = setup();
    expect(await service.resolve('session=customer')).toEqual({ ok: false, reason: 'signed-out' });
    expect(pool.query).not.toHaveBeenCalled();
    pool.query.mockResolvedValue({ rows: [] });
    expect(await service.resolve('staff_session=ghost')).toEqual({ ok: false, reason: 'signed-out' });
  });
});

describe('StaffSessionService.start / end', () => {
  it('start stores only the hash and sets an HttpOnly cookie', async () => {
    const { pool, service } = setup();
    const res = { cookie: jest.fn() } as unknown as Response;
    await service.start(res, 's1');
    const [name, token, opts] = (res.cookie as jest.Mock).mock.calls[0];
    expect(name).toBe(STAFF_SESSION_COOKIE);
    expect(pool.query.mock.calls[0][1]).toEqual([hashToken(token), 's1']);
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax' });
  });

  it('end deletes the row by hashed token and clears the cookie', async () => {
    const { pool, service } = setup();
    const res = { clearCookie: jest.fn() } as unknown as Response;
    await service.end('staff_session=tok', res);
    expect(pool.query).toHaveBeenCalledWith('delete from staff_sessions where token_hash = $1', [
      hashToken('tok'),
    ]);
    expect(res.clearCookie).toHaveBeenCalledWith(STAFF_SESSION_COOKIE, expect.any(Object));
  });
});
