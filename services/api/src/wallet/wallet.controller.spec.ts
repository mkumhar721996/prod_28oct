import { ConflictException } from '@nestjs/common';
import { PlayerRequest } from '../session/session.guard';
import { WalletController } from './wallet.controller';
import { TOP_UP_NOT_LOW_MESSAGE } from './wallet.constants';
import { WalletService } from './wallet.service';

const req = { player: { id: 'p1' } } as unknown as PlayerRequest;

function setup(overrides: Partial<Record<keyof WalletService, unknown>> = {}) {
  const wallet = {
    topUpCredits: 500,
    balanceFor: jest.fn(async () => 1),
    claimTopUp: jest.fn(async () => ({ ok: true, balanceCredits: 501 })),
    historyFor: jest.fn(async () => ({ entries: [] })),
    ...overrides,
  };
  return { wallet, controller: new WalletController(wallet as unknown as WalletService) };
}

describe('WalletController', () => {
  it('GET /wallet reports top-up eligibility at a balance of 1', async () => {
    const { controller, wallet } = setup();
    expect(await controller.balance(req)).toEqual({
      balanceCredits: 1,
      topUp: { eligible: true, credits: 500 },
    });
    expect(wallet.balanceFor).toHaveBeenCalledWith('p1');
  });

  it('GET /wallet reports not eligible at a balance of 2', async () => {
    const { controller } = setup({ balanceFor: jest.fn(async () => 2) });
    expect((await controller.balance(req)).topUp.eligible).toBe(false);
  });

  it('POST /wallet/top-up returns the new balance and granted credits', async () => {
    const { controller, wallet } = setup();
    expect(await controller.topUp(req)).toEqual({ balanceCredits: 501, grantedCredits: 500 });
    expect(wallet.claimTopUp).toHaveBeenCalledWith('p1');
  });

  it('POST /wallet/top-up is a 409 when the balance is not low', async () => {
    const { controller } = setup({
      claimTopUp: jest.fn(async () => ({ ok: false, reason: 'balance_not_low' })),
    });
    await expect(controller.topUp(req)).rejects.toBeInstanceOf(ConflictException);
    await expect(controller.topUp(req)).rejects.toThrow(TOP_UP_NOT_LOW_MESSAGE);
    expect(TOP_UP_NOT_LOW_MESSAGE).toMatch(/only available when your balance is 1 credit or less/);
  });

  it.each([
    [undefined, undefined, 1, 'recent'],
    ['abc', 'bogus', 1, 'recent'],
    ['0', 'all', 1, 'all'],
    ['3', 'all', 3, 'all'],
  ])('GET /wallet/history page=%s range=%s', async (page, range, expectedPage, expectedRange) => {
    const { controller, wallet } = setup();
    await controller.history(req, page, range);
    expect(wallet.historyFor).toHaveBeenCalledWith('p1', {
      page: expectedPage,
      range: expectedRange,
      view: 'wallet',
    });
  });

  it.each([
    ['play', 'play'],
    ['bogus', 'wallet'],
    [undefined, 'wallet'],
  ])('GET /wallet/history view=%s uses %s', async (view, expected) => {
    const { controller, wallet } = setup();
    await controller.history(req, undefined, undefined, view);
    expect(wallet.historyFor).toHaveBeenCalledWith('p1', expect.objectContaining({ view: expected }));
  });
});
