import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AttemptLimiter } from '../session/attempt-limiter.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffSessionService } from './staff-session.service';

function setup() {
  const staff = { authenticate: jest.fn(), create: jest.fn() };
  const sessions = { start: jest.fn(), end: jest.fn() };
  const controller = new StaffController(
    staff as unknown as StaffService,
    sessions as unknown as StaffSessionService,
    new AttemptLimiter(),
  );
  return { controller, staff, sessions, req: { ip: '10.0.0.1' } as never, res: {} as never };
}

const creds = { email: 'amira.hassan@bank.example', password: 'Staff-pass1' };

describe('StaffController', () => {
  it('signs staff in and starts a staff session', async () => {
    const { controller, staff, sessions, req, res } = setup();
    staff.authenticate.mockResolvedValue({ id: 's1', email: creds.email });
    await expect(controller.signIn(creds, req, res)).resolves.toEqual({ email: creds.email });
    expect(sessions.start).toHaveBeenCalledWith(res, 's1');
  });

  it('refuses wrong password and customer credentials alike', async () => {
    const { controller, staff, sessions, req, res } = setup();
    staff.authenticate.mockResolvedValue(null);
    const first = await controller.signIn(creds, req, res).catch((e) => e);
    const second = await controller
      .signIn({ email: 'jo.carter@example.com', password: 'Cust-pass1' }, req, res)
      .catch((e) => e);
    expect(first).toBeInstanceOf(UnauthorizedException);
    expect(second.message).toBe(first.message);
    expect(sessions.start).not.toHaveBeenCalled();
  });

  it('locks sign-in for an email after 10 failures', async () => {
    const { controller, staff, req, res } = setup();
    staff.authenticate.mockResolvedValue(null);
    for (let i = 0; i < 10; i++) await controller.signIn(creds, req, res).catch(() => undefined);
    await controller.signIn(creds, { ip: '10.0.0.2' } as never, res).catch(() => undefined);
    expect(staff.authenticate).toHaveBeenCalledTimes(10);
  });

  it('register always refuses and creates nothing', async () => {
    const { controller, staff, sessions, req } = setup();
    await expect(
      controller.register({ email: 'x@bank.example', password: 'Whatever-123' }, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(staff.create).not.toHaveBeenCalled();
    expect(sessions.start).not.toHaveBeenCalled();
  });

  it('sign-out ends the session', async () => {
    const { controller, sessions, res } = setup();
    await controller.signOut({ headers: { cookie: 'staff_session=t' } } as never, res);
    expect(sessions.end).toHaveBeenCalledWith('staff_session=t', res);
  });
});
