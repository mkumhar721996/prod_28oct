import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { AttemptLimiter } from '../session/attempt-limiter.service';
import { hashToken } from '../session/session.service';
import { AccountsController } from '../accounts/accounts.controller';
import { OrganizationsController } from '../organizations/organizations.controller';
import { AuthSessionService } from './auth-session.service';
import { ORG_IDLE_MS, ORG_SESSION_COOKIE, ORG_SIGN_IN_REFUSAL } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

const ctx = (req: object, handler: object = () => undefined, cls: object = class {}) =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => cls,
  }) as unknown as ExecutionContext;

describe('AuthGuard', () => {
  it('AC3: refuses a request with no live session and sets no user', async () => {
    const resolve = jest.fn().mockResolvedValue({ ok: false, reason: 'signed-out' });
    const guard = new AuthGuard({ resolve } as unknown as AuthSessionService);
    const req = { headers: {} };
    await expect(guard.canActivate(ctx(req))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(req).not.toHaveProperty('user');
  });

  it('AC11: carries the expired reason in the 401 body', async () => {
    const resolve = jest.fn().mockResolvedValue({ ok: false, reason: 'expired' });
    const guard = new AuthGuard({ resolve } as unknown as AuthSessionService);
    await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toMatchObject({
      response: { reason: 'expired' },
    });
  });

  it('sets req.user for a live session', async () => {
    const user = { id: 'u1', email: 'a@org.example', role: 'staff' };
    const guard = new AuthGuard({
      resolve: jest.fn().mockResolvedValue({ ok: true, user }),
    } as unknown as AuthSessionService);
    const req: { headers: object; user?: unknown } = { headers: {} };
    expect(await guard.canActivate(ctx(req))).toBe(true);
    expect(req.user).toEqual(user);
  });
});

describe('RolesGuard on the real controllers', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = (controller: { prototype: object }, name: string) =>
    (controller.prototype as Record<string, object>)[name];
  const check = (controller: { prototype: object }, name: string, role?: string) =>
    guard.canActivate(
      ctx(role ? { user: { role } } : {}, handler(controller, name), controller),
    );

  it.each(['staff', 'fundraising_consultant'])('AC6/AC8: %s cannot delete or create accounts', (role) => {
    expect(() => check(OrganizationsController, 'remove', role)).toThrow(ForbiddenException);
    expect(() => check(AccountsController, 'create', role)).toThrow(ForbiddenException);
  });

  it('AC7/AC1: a super_admin may delete organizations and create accounts', () => {
    expect(check(OrganizationsController, 'remove', 'super_admin')).toBe(true);
    expect(check(AccountsController, 'create', 'super_admin')).toBe(true);
  });

  it('fails closed with no user or no role list', () => {
    expect(() => check(OrganizationsController, 'remove')).toThrow(ForbiddenException);
    expect(() => check(OrganizationsController, 'get', 'super_admin')).toThrow(ForbiddenException);
  });

  it('AC3: every organization route sits behind AuthGuard', () => {
    expect(Reflect.getMetadata('__guards__', OrganizationsController)).toContain(AuthGuard);
    expect(Reflect.getMetadata('__guards__', AccountsController)).toEqual([AuthGuard, RolesGuard]);
  });
});

describe('AuthSessionService', () => {
  const T0 = new Date('2026-01-01T09:00:00Z').getTime();
  const user = { id: 'u1', email: 'a@org.example', role: 'staff' };

  function setup() {
    const pool = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.startsWith('update app_sessions')) {
          return { rows: T0 > (params[1] as Date).getTime() ? [user] : [] };
        }
        return { rows: sql.startsWith('select 1') ? [{}] : [] };
      }),
    };
    return { pool, service: new AuthSessionService({ pool } as unknown as DatabaseService) };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('AC11: refuses a session idle for exactly the limit, with reason expired', async () => {
    const { service } = setup();
    jest.setSystemTime(T0 + ORG_IDLE_MS);
    expect(await service.resolve(`${ORG_SESSION_COOKIE}=tok`)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('opens for a live session and is signed-out without the cookie', async () => {
    const { pool, service } = setup();
    jest.setSystemTime(T0 + 60_000);
    expect(await service.resolve(`${ORG_SESSION_COOKIE}=tok`)).toEqual({ ok: true, user });
    expect(await service.resolve('session=customer')).toEqual({ ok: false, reason: 'signed-out' });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('start stores only the hash; end deletes by hash and clears the cookie', async () => {
    const { pool, service } = setup();
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    await service.start(res, 'u1');
    const [name, token, opts] = (res.cookie as jest.Mock).mock.calls[0];
    expect(name).toBe(ORG_SESSION_COOKIE);
    expect(pool.query.mock.calls[0][1]).toEqual([hashToken(token), 'u1']);
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    await service.end(`${ORG_SESSION_COOKIE}=${token}`, res);
    expect(pool.query).toHaveBeenLastCalledWith(
      'delete from app_sessions where token_hash = $1',
      [hashToken(token)],
    );
    expect(res.clearCookie).toHaveBeenCalled();
  });
});

describe('AuthController', () => {
  function setup() {
    const accounts = { authenticate: jest.fn() };
    const sessions = { start: jest.fn(), end: jest.fn() };
    const controller = new AuthController(
      accounts as never,
      sessions as never,
      new AttemptLimiter(),
    );
    return { controller, accounts, sessions, req: { ip: '10.0.0.1' } as never, res: {} as never };
  }
  const creds = { email: 'a@org.example', password: 'Welcome-2026' };

  it.each(['super_admin', 'staff', 'fundraising_consultant'])(
    'AC10: signs in a %s and starts a session',
    async (role) => {
      const { controller, accounts, sessions, req, res } = setup();
      accounts.authenticate.mockResolvedValue({ id: 'u1', email: creds.email, role });
      await expect(controller.signIn(creds, req, res)).resolves.toEqual({
        email: creds.email,
        role,
      });
      expect(sessions.start).toHaveBeenCalledWith(res, 'u1');
    },
  );

  it('AC2: a refused sign-in says "Email or password is incorrect" and starts nothing', async () => {
    const { controller, accounts, sessions, req, res } = setup();
    accounts.authenticate.mockResolvedValue(null);
    const err = await controller.signIn(creds, req, res).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.message).toBe(ORG_SIGN_IN_REFUSAL);
    expect(ORG_SIGN_IN_REFUSAL).toBe('Email or password is incorrect');
    expect(sessions.start).not.toHaveBeenCalled();
  });

  it('AC11: sign-out ends the session', async () => {
    const { controller, sessions, res } = setup();
    await controller.signOut({ headers: { cookie: 'app_session=t' } } as never, res);
    expect(sessions.end).toHaveBeenCalledWith('app_session=t', res);
  });

  it('current returns email and role', () => {
    const { controller } = setup();
    expect(
      controller.current({ user: { id: 'u1', email: 'a@org.example', role: 'staff' } } as never),
    ).toEqual({ email: 'a@org.example', role: 'staff' });
  });
});
