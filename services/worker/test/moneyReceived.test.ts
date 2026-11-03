import { readFileSync } from 'fs';
import { join } from 'path';
import { buildJobs } from '../src/jobs';
import { MONEY_RECEIVED_QUEUE, MoneyReceivedEvent, createMoneyReceivedJob } from '../src/jobs/moneyReceived';

const event: MoneyReceivedEvent = {
  eventId: 'evt_1',
  recipientId: 'p1',
  senderName: 'Sam Okafor',
  amountMinor: 12000,
  currency: 'USD',
};

describe('money-received job', () => {
  it('inserts one alert for the event', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    await createMoneyReceivedJob({ query }).handler(event);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(['p1', 'evt_1', 12000, 'USD', 'Sam Okafor']);
    expect(query.mock.calls[0][0]).toContain("'money_received'");
  });

  it.each([0, -5, undefined])('rejects an amount of %s without a query', async (amountMinor) => {
    const query = jest.fn();
    const job = createMoneyReceivedJob({ query });
    await expect(job.handler({ ...event, amountMinor } as MoneyReceivedEvent)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a payload missing the event id', async () => {
    const query = jest.fn();
    const job = createMoneyReceivedJob({ query });
    await expect(job.handler({ ...event, eventId: '' })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it('registers the queue', () => {
    expect(buildJobs({ query: jest.fn() }).map((j) => j.name)).toContain(MONEY_RECEIVED_QUEUE);
  });

  it('is safe to process the same event twice', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 });
    const job = createMoneyReceivedJob({ query });
    expect(query).not.toHaveBeenCalled();
    await job.handler(event);
    await expect(job.handler(event)).resolves.toBeUndefined();
    expect(query.mock.calls[0][0]).toContain('on conflict (player_id, kind, event_id) do nothing');
    const sql = readFileSync(join(__dirname, '../../api/migrations/005_alerts.sql'), 'utf8');
    expect(sql).toMatch(/unique index if not exists alerts_player_event_uniq\s+on alerts \(player_id, kind, event_id\)/);
    expect(sql).toContain('alerts_player_created_idx');
    expect(sql).toMatch(/on alerts \(player_id, created_at desc, id desc\)/);
  });
});
