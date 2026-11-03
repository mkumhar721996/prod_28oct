import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '../database/database.service';
import { OrdersService, PlaceOrderInput } from './orders.service';

function setup(handler: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [{ id: 'o1', number: 1001 }] })) {
  const query = jest.fn(async (sql: string, params?: unknown[]) => handler(sql, params));
  const service = new OrdersService({ pool: { query } } as unknown as DatabaseService);
  return { service, query };
}

const lines = [{ id: 'p1', name: 'Pizza', unitPrice: 900, quantity: 2 }];
const collection: PlaceOrderInput = {
  fulfilment: 'collection',
  name: 'Ana',
  phone: '0123456789',
  lines,
  idempotencyKey: 'key-1',
};
const delivery: PlaceOrderInput = {
  ...collection,
  fulfilment: 'delivery',
  address: '12 MG Road, Bengaluru, 560103',
};

describe('OrdersService.place', () => {
  it('creates a collection order for the session customer with no address', async () => {
    const { service, query } = setup();
    const res = await service.place('player-1', collection);
    expect(res).toEqual({ ok: true, order: { id: 'o1', number: '1001' }, replayed: false });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('insert into orders'),
      expect.arrayContaining(['player-1', 'collection', null]),
    );
  });

  it('creates a delivery order with the address', async () => {
    const { service, query } = setup();
    const res = await service.place('player-1', delivery);
    expect(res.ok).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('insert into orders'),
      expect.arrayContaining(['player-1', 'delivery', '12 MG Road, Bengaluru, 560103']),
    );
  });

  it('ignores an address sent with a collection order', async () => {
    const { service, query } = setup();
    await service.place('player-1', { ...collection, address: 'anything' });
    expect(query.mock.calls[0][1]).toContain(null);
    expect(query.mock.calls[0][1]).not.toContain('anything');
  });

  it.each([
    ['blank name', { name: '  ' }],
    ['short phone', { phone: '123456789' }],
    ['long phone', { phone: '1234567890123456' }],
    ['delivery without address', { fulfilment: 'delivery' as const }],
    ['address without PIN code', { fulfilment: 'delivery' as const, address: '12 MG Road, Bengaluru' }],
    ['unknown fulfilment', { fulfilment: 'drone' as never }],
    ['blank key', { idempotencyKey: ' ' }],
    ['bad line', { lines: [{ id: 'p1', name: 'Pizza', unitPrice: 900, quantity: 0 }] }],
    ['too many lines', { lines: Array.from({ length: 51 }, (_, i) => ({ ...lines[0], id: `p${i}` })) }],
    ['oversized quantity', { lines: [{ ...lines[0], quantity: 100 }] }],
    ['oversized line name', { lines: [{ ...lines[0], name: 'x'.repeat(201) }] }],
    ['oversized name', { name: 'x'.repeat(101) }],
    ['oversized phone', { phone: '1'.repeat(10) + ' '.repeat(40) }],
    ['oversized address', { fulfilment: 'delivery' as const, address: `12 MG Road, ${'x'.repeat(300)}, 560103` }],
    ['oversized key', { idempotencyKey: 'k'.repeat(101) }],
  ])('refuses %s and runs no query', async (_label, patch) => {
    const { service, query } = setup();
    expect(await service.place('player-1', { ...collection, ...patch })).toEqual({ ok: false, code: 'invalid' });
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses an empty cart', async () => {
    const { service, query } = setup();
    expect(await service.place('player-1', { ...collection, lines: [] })).toEqual({
      ok: false,
      code: 'empty_cart',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('returns the existing order when the same key is submitted again', async () => {
    const { service, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'o1', number: 1001 }] } as never);
    const res = await service.place('player-1', collection);
    expect(res).toMatchObject({ ok: true, replayed: true, order: { id: 'o1', number: '1001' } });
    expect(query.mock.calls[1][1]).toEqual(['player-1', 'key-1']);
  });

  it('rethrows a database failure', async () => {
    const { service } = setup(() => {
      throw new Error('down');
    });
    await expect(service.place('player-1', collection)).rejects.toThrow('down');
  });
});

describe('004_orders.sql', () => {
  const sql = readFileSync(join(__dirname, '../../migrations/004_orders.sql'), 'utf8');

  it('declares the order number sequence and both unique indexes', () => {
    expect(sql).toMatch(/create sequence if not exists orders_number_seq\s+start (with )?1001/i);
    expect(sql).toMatch(/orders_number_uniq/);
    expect(sql).toMatch(/orders_player_idem_uniq/);
  });

  it('ties delivery to an address and collection to none', () => {
    expect(sql).toMatch(/fulfilment in \('delivery', 'collection'\)/);
    expect(sql).toMatch(/fulfilment = 'collection' and address is null/);
  });
});
