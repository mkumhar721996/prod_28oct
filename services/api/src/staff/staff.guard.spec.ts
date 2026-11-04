import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { StaffGuard } from './staff.guard';
import { StaffSessionService } from './staff-session.service';

const ctx = (req: object) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

function setup() {
  const resolve = jest.fn();
  return { resolve, guard: new StaffGuard({ resolve } as unknown as StaffSessionService) };
}

describe('StaffGuard', () => {
  it('refuses a request carrying only a customer session cookie', async () => {
    const { guard, resolve } = setup();
    resolve.mockResolvedValue({ ok: false, reason: 'signed-out' });
    const req = { headers: { cookie: 'session=cust' } };
    await expect(guard.canActivate(ctx(req))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(req).not.toHaveProperty('staff');
  });

  it('carries the refusal reason in the 401 body', async () => {
    const { guard, resolve } = setup();
    resolve.mockResolvedValue({ ok: false, reason: 'expired' });
    await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toMatchObject({
      response: { reason: 'expired' },
    });
  });

  it('sets req.staff for a live staff session', async () => {
    const { guard, resolve } = setup();
    resolve.mockResolvedValue({ ok: true, staff: { id: 's1', email: 'a@bank.example' } });
    const req: { headers: object; staff?: unknown } = { headers: { cookie: 'staff_session=t' } };
    expect(await guard.canActivate(ctx(req))).toBe(true);
    expect(req.staff).toEqual({ id: 's1', email: 'a@bank.example' });
  });
});
