import { DatabaseService } from '../database/database.service';
import { AlertsService } from './alerts.service';

const ID = '3f0c7c9e-2d6b-4a55-9a53-0a1b2c3d4e5f';
const row = {
  id: ID,
  kind: 'money_received',
  amount_minor: '12000',
  currency: 'USD',
  sender_name: 'Sam Okafor',
  read_at: null,
  created_at: new Date('2026-11-02T09:00:00Z'),
};

function setup(rows: unknown[] = [row]) {
  const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows }));
  return { service: new AlertsService({ pool: { query } } as unknown as DatabaseService), query };
}

describe('AlertsService', () => {
  it('lists the customer’s alerts, newest first, scoped by the session player', async () => {
    const { service, query } = setup();
    const alerts = await service.listFor('customerA');
    expect(query.mock.calls[0][0]).toContain('where player_id = $1');
    expect(query.mock.calls[0][0]).toContain('order by created_at desc, id desc');
    expect(query.mock.calls[0][1]).toEqual(['customerA']);
    expect(alerts).toEqual([
      {
        id: ID,
        kind: 'money_received',
        amountMinor: 12000,
        currency: 'USD',
        senderName: 'Sam Okafor',
        read: false,
        createdAt: '2026-11-02T09:00:00.000Z',
      },
    ]);
  });

  it('counts only unread alerts of the customer', async () => {
    const { service, query } = setup([{ count: '2' }]);
    await expect(service.unreadCountFor('p1')).resolves.toBe(2);
    expect(query.mock.calls[0][0]).toContain('where player_id = $1 and read_at is null');
    expect(query.mock.calls[0][1]).toEqual(['p1']);
  });

  it('marks read idempotently and only for the owner', async () => {
    const { service, query } = setup([{ ...row, read_at: new Date() }]);
    const first = await service.markRead('p1', ID);
    const again = await service.markRead('p1', ID);
    expect(query.mock.calls[0][0]).toContain('set read_at = coalesce(read_at, now())');
    expect(query.mock.calls[0][0]).toContain('and player_id = $2');
    expect(query.mock.calls[0][1]).toEqual([ID, 'p1']);
    expect(first?.read).toBe(true);
    expect(again?.read).toBe(true);
  });

  it('returns null for an alert that belongs to someone else', async () => {
    const { service } = setup([]);
    await expect(service.markRead('p1', ID)).resolves.toBeNull();
  });
});
