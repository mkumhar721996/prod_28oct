import { HttpException, UnauthorizedException } from '@nestjs/common';
import { PlayersService } from '../players/players.service';
import { AttemptLimiter } from './attempt-limiter.service';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

function setup() {
  const players = { authenticate: jest.fn(), register: jest.fn() };
  const sessions = { start: jest.fn() };
  const limiter = new AttemptLimiter();
  const controller = new SessionController(
    players as unknown as PlayersService,
    sessions as unknown as SessionService,
    limiter,
  );
  const req = { ip: '10.0.0.1' } as never;
  const res = {} as never;
  return { controller, players, sessions, req, res };
}

const creds = { email: 'ana@example.com', password: 'play-2026' };

describe('SessionController throttling', () => {
  it('locks sign-in for an email after repeated failures, even from a new IP', async () => {
    const { controller, players, req, res } = setup();
    players.authenticate.mockResolvedValue(null);
    for (let i = 0; i < 10; i++) {
      await expect(controller.signIn(creds, req, res)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const otherIp = { ip: '10.0.0.2' } as never;
    await expect(controller.signIn(creds, otherIp, res)).rejects.toBeInstanceOf(HttpException);
    expect(players.authenticate).toHaveBeenCalledTimes(10);
  });

  it('a right password after a few wrong ones still signs in and clears the count', async () => {
    const { controller, players, sessions, req, res } = setup();
    players.authenticate.mockResolvedValueOnce(null).mockResolvedValue({ id: 'p1', email: creds.email });
    await expect(controller.signIn(creds, req, res)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.signIn(creds, req, res)).resolves.toEqual({
      role: 'player',
      email: creds.email,
    });
    expect(sessions.start).toHaveBeenCalledWith(res, 'p1');
  });

  it('limits registrations per IP', async () => {
    const { controller, players, req, res } = setup();
    players.register.mockResolvedValue({ id: 'p1', email: creds.email });
    for (let i = 0; i < 20; i++) await controller.register(creds, req, res);
    await expect(controller.register(creds, req, res)).rejects.toBeInstanceOf(HttpException);
  });
});
