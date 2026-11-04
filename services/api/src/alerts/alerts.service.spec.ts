import { DatabaseService } from '../database/database.service';
import { AlertsService } from './alerts.service';

const row = (id: string, readAt: Date | null = null) => ({
  id,
  kind: 'money_received',
  amount_minor: '12000',
  currency: 'USD',
  sender_name: 'Sam Okafor',
  created_at: new Date('2026-11-02T09:00:00Z'),
  read_at: readAt,
});

function setup(rows: unknown[]) {
  const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows }));
  return { service: new AlertsService({ pool: { query } } as unknown as DatabaseService), query };
}

describe('AlertsService', () => {
  it('lists the customer’s alerts newest first, mapped to the view', async () => {
    const { service, query } = setup([row('3'), row('2', new Date()), row('1')]);
    const alerts = await service.listFor('p1');
    expect(query.mock.calls[0][0]).toContain('where player_id = $1');
    expect(query.mock.calls[0][0]).toContain('order by created_at desc, id desc');
    expect(query.mock.calls[0][1]).toEqual(['p1']);
    expect(alerts.map((a) => a.id)).toEqual(['3', '2', '1']);
    expect(alerts.map((a) => a.read)).toEqual([false, true, false]);
    expect(alerts[0]).toEqual({
      id: '3',
      kind: 'money_received',
      amountMinor: 12000,
      currency: 'USD',
      senderName: 'Sam Okafor',
      createdAt: '2026-11-02T09:00:00.000Z',
      read: false,
    });
  });

  it('maps identity decision alerts, which carry no amount, currency or sender', async () => {
    const { service } = setup([
      { ...row('4'), kind: 'identity_approved', amount_minor: null, currency: null, sender_name: null },
    ]);
    const [alert] = await service.listFor('p1');
    expect(alert).toMatchObject({ kind: 'identity_approved', amountMinor: null, currency: null, senderName: null });
  });

  it('counts the customer’s unread alerts', async () => {
    const { service, query } = setup([{ count: '2' }]);
    await expect(service.unreadCountFor('p1')).resolves.toBe(2);
    expect(query.mock.calls[0][0]).toContain('where player_id = $1 and read_at is null');
    expect(query.mock.calls[0][1]).toEqual(['p1']);
  });

  it('marks read idempotently, scoped to the owner', async () => {
    const { service, query } = setup([row('5', new Date())]);
    await expect(service.markRead('p1', '5')).resolves.toMatchObject({ id: '5', read: true });
    await expect(service.markRead('p1', '5')).resolves.toMatchObject({ read: true });
    expect(query.mock.calls[0][0]).toContain('set read_at = coalesce(read_at, now())');
    expect(query.mock.calls[0][0]).toContain('and player_id = $2');
    expect(query.mock.calls[0][1]).toEqual(['5', 'p1']);
  });

  it('returns null when the alert is not the customer’s', async () => {
    const { service } = setup([]);
    await expect(service.markRead('p1', '5')).resolves.toBeNull();
  });
});
