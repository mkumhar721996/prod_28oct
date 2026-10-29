import { BadRequestException, ConflictException } from '@nestjs/common';
import { PlayerRequest } from '../session/session.guard';
import { GameController } from './game.controller';
import { GameService } from './game.service';

const req = { player: { id: 'p1' } } as unknown as PlayerRequest;
const jackpot = { miniCents: 0, minorCents: 0, majorCents: 0, grandCents: 0, totalCents: 0 };
const spun = {
  ok: true,
  reels: ['cherry', 'bar', 'bar'],
  bet: 100,
  winCredits: 0,
  label: null,
  balanceCredits: 900,
  jackpot,
};

function setup(spin: unknown = spun) {
  const game = {
    stateFor: jest.fn(async () => ({ balanceCredits: 1000, jackpot })),
    spin: jest.fn(async () => spin),
  };
  return { game, controller: new GameController(game as unknown as GameService) };
}

describe('GameController', () => {
  it('GET /game uses the session player', async () => {
    const { controller, game } = setup();
    expect(await controller.state(req)).toEqual({ balanceCredits: 1000, jackpot });
    expect(game.stateFor).toHaveBeenCalledWith('p1');
  });

  it('POST /game/spin returns the settled spin from the session player', async () => {
    const { controller, game } = setup();
    const { ok, ...expected } = spun;
    expect(ok).toBe(true);
    expect(await controller.spin(req, { bet: 100 })).toEqual(expected);
    expect(game.spin).toHaveBeenCalledWith('p1', 100);
  });

  it.each([{ bet: 7 }, { bet: '100' }, undefined])('is a 400 for %p', async (body) => {
    const { controller } = setup({ ok: false, reason: 'invalid_bet' });
    await expect(controller.spin(req, body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AC10: is a 409 saying the balance does not cover the bet', async () => {
    const { controller } = setup({ ok: false, reason: 'insufficient_balance', balanceCredits: 100 });
    const err = await controller.spin(req, { bet: 250 }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toEqual({
      message: 'Your balance of 100 does not cover a bet of 250. Choose a lower bet.',
      balanceCredits: 100,
    });
  });
});
