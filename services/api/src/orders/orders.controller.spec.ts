import { BadRequestException } from '@nestjs/common';
import { PlayerRequest, SessionGuard } from '../session/session.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const req = { player: { id: 'player-1' } } as unknown as PlayerRequest;
const body = {
  fulfilment: 'collection' as const,
  name: 'Ana',
  phone: '0123456789',
  lines: [{ id: 'p1', name: 'Pizza', unitPrice: 900, quantity: 2 }],
  idempotencyKey: 'key-1',
};

function setup(result: unknown = { ok: true, order: { id: 'o1', number: '1001' }, replayed: false }) {
  const service = { place: jest.fn(async (_id: string, _input: object) => result) };
  const res = { status: jest.fn() };
  const controller = new OrdersController(service as unknown as OrdersService);
  return { service, res, controller };
}

describe('OrdersController', () => {
  it('is behind the session guard', () => {
    const guards = Reflect.getMetadata('__guards__', OrdersController) as unknown[];
    expect(guards).toContain(SessionGuard);
  });

  it('places the order for the session customer and answers 201', async () => {
    const { controller, service, res } = setup();
    expect(await controller.place(req, body, res as never)).toEqual({ order: { id: 'o1', number: '1001' } });
    expect(service.place).toHaveBeenCalledWith('player-1', expect.objectContaining({ name: 'Ana' }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('ignores a player id in the body', async () => {
    const { controller, service, res } = setup();
    await controller.place(req, { ...body, playerId: 'someone-else' } as never, res as never);
    expect(service.place).toHaveBeenCalledWith('player-1', expect.any(Object));
    expect(service.place.mock.calls[0][1]).not.toHaveProperty('playerId');
  });

  it('answers 200 for a replayed submission', async () => {
    const { controller, res } = setup({ ok: true, order: { id: 'o1', number: '1001' }, replayed: true });
    await controller.place(req, body, res as never);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each(['invalid', 'empty_cart'])('maps %s to 400', async (code) => {
    const { controller, res } = setup({ ok: false, code });
    await expect(controller.place(req, body, res as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    [undefined],
    [{ ...body, name: 5 }],
    [{ ...body, lines: 'x' }],
    [{ ...body, address: 7 }],
    [{ ...body, idempotencyKey: undefined }],
  ])('rejects a malformed body %j without calling the service', async (bad) => {
    const { controller, service, res } = setup();
    await expect(controller.place(req, bad as never, res as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.place).not.toHaveBeenCalled();
  });
});
