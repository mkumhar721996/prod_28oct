import { ConflictException } from '@nestjs/common';
import { PlayerRequest } from '../session/session.guard';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { TransfersService } from './transfers.service';

const req = { player: { id: 'p1' } } as unknown as PlayerRequest;
const accounts = [
  { id: 'c', kind: 'checking', balance: 100, frozen: false },
  { id: 's', kind: 'savings', balance: 100, frozen: true },
];

function setup(result: unknown) {
  const transfers = { execute: jest.fn(async () => result) };
  const list = { listFor: jest.fn(async () => accounts) };
  return {
    transfers,
    controller: new AccountsController(
      list as unknown as AccountsService,
      transfers as unknown as TransfersService,
    ),
  };
}

const body = { fromAccountId: 'c', toAccountId: 's', amount: 150, idempotencyKey: 'k' };

describe('AccountsController', () => {
  it('GET /accounts lists the session player’s accounts', async () => {
    const { controller } = setup(null);
    expect(await controller.list(req)).toEqual(accounts);
  });

  it('POST /transfers uses the session player and returns both balances and a reference', async () => {
    const { controller, transfers } = setup({
      ok: true,
      transferId: 'abcdef12-0000',
      from: { id: 'c', balance: 50 },
      to: { id: 's', balance: 250 },
      replayed: false,
    });
    const out = await controller.transfer(req, { ...body, amount: 50, playerId: 'evil' } as never);
    expect(transfers.execute).toHaveBeenCalledWith('p1', expect.objectContaining({ amount: 50 }));
    expect(out).toMatchObject({
      transferId: 'abcdef12-0000',
      reference: 'TRF-ABCDEF12',
      from: { id: 'c', balance: 50 },
      to: { id: 's', balance: 250 },
      replayed: false,
    });
  });

  it('AC5: a low balance is a 409 "Transfer not made." naming the available amount', async () => {
    const { controller } = setup({ ok: false, reason: 'insufficient_balance' });
    const err = await controller.transfer(req, body).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toEqual({
      message: 'Transfer not made. Checking does not have 150 available. Enter 100 or less.',
      reason: 'insufficient_balance',
    });
  });

  it('AC7/AC8: names the frozen account', async () => {
    const source = await setup({ ok: false, reason: 'source_frozen' }).controller
      .transfer(req, body)
      .catch((e) => e);
    expect(source.getResponse().message).toBe(
      'Transfer not made. Checking is frozen, so money cannot move in or out.',
    );
    const dest = await setup({ ok: false, reason: 'destination_frozen' }).controller
      .transfer(req, body)
      .catch((e) => e);
    expect(dest.getResponse().message).toBe(
      'Transfer not made. Savings is frozen, so money cannot move in or out.',
    );
  });
});
