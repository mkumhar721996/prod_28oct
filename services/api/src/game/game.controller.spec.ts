import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { GameController } from './game.controller';
import { GameService } from './game.service';

const req = { player: { id: 'p1' } } as unknown as PlayerRequest;
const jackpot = { miniCents: 0, minorCents: 0, majorCents: 0, grandCents: 0, totalCents: 0 };
const spun = { ok: true, reels: ['bar', 'bar', 'bar'], bet: 100, winCredits: 0, label: null, balanceCredits: 900, jackpot };

function setup(spin: unknown = jest.fn(async () => spun)) {
  const game = { stateFor: jest.fn(async () => ({ balanceCredits: 1000, jackpot })), spin };
  return { game, controller: new GameController(game as unknown as GameService) };
}

describe('GameController', () => {
  it('GET /game returns the state for the session player', async () => {
    const { controller, game } = setup();
    expect(await controller.state(req)).toEqual({ balanceCredits: 1000, jackpot });
    expect(game.stateFor).toHaveBeenCalledWith('p1');
  });

  it('POST /game/spin spins for the session player, never one named in the body', async () => {
    const { controller, game } = setup();
    expect(await controller.spin(req, { bet: 100, playerId: 'p2' } as never)).toEqual(spun);
    expect(game.spin).toHaveBeenCalledWith('p1', 100);
  });

  it.each([{ bet: 7 }, { bet: '100' }, undefined])('POST /game/spin is a 400 for %p', async (body) => {
    const { controller } = setup(jest.fn(async () => ({ ok: false, reason: 'invalid_bet' })));
    await expect(controller.spin(req, body as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AC10: POST /game/spin is a 409 naming the balance and the bet', async () => {
    const { controller } = setup(
      jest.fn(async () => ({ ok: false, reason: 'insufficient_balance', balanceCredits: 100 })),
    );
    const error = await controller.spin(req, { bet: 250 }).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual({
      message: 'Your balance of 100 does not cover a bet of 250. Choose a lower bet.',
      balanceCredits: 100,
    });
  });

  it('is behind the session guard, so every route needs a session', () => {
    expect(Reflect.getMetadata('__guards__', GameController)).toContain(SessionGuard);
  });
});
