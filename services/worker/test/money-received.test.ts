import { readFileSync } from 'fs';
import { join } from 'path';
import { jobs } from '../src/jobs';
import { MONEY_RECEIVED_QUEUE, MoneyReceivedEvent, handleMoneyReceived } from '../src/jobs/money-received';

const evt: MoneyReceivedEvent = {
  eventId: 'evt_1',
  recipientPlayerId: 'p1',
  amountMinor: 12000,
  currency: 'USD',
  senderName: 'Sam Okafor',
};

describe('handleMoneyReceived', () => {
  it('inserts one alert for the event', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    await expect(handleMoneyReceived(evt, db)).resolves.toEqual({ created: true });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toMatch(/insert into alerts/i);
    expect(db.query.mock.calls[0][1]).toEqual(['p1', 'evt_1', 12000, 'USD', 'Sam Okafor']);
  });

  it('treats a duplicate event as a no-op, not an error', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
    await expect(handleMoneyReceived(evt, db)).resolves.toEqual({ created: false });
    expect(db.query.mock.calls[0][0]).toMatch(/on conflict \(kind, event_id\) do nothing/i);
  });

  it.each([
    { amountMinor: 0 },
    { amountMinor: -1 },
    { amountMinor: 1.5 },
    { eventId: '' },
    { recipientPlayerId: '' },
    { senderName: '' },
    { currency: '' },
  ])('rejects a bad payload %o without querying', async (bad) => {
    const db = { query: jest.fn() };
    await expect(handleMoneyReceived({ ...evt, ...bad }, db)).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('registers the queue with retries', () => {
    const job = jobs.find((j) => j.name === MONEY_RECEIVED_QUEUE);
    expect(job?.retryLimit).toBeGreaterThan(0);
  });

  it('is backed by a unique index on (kind, event_id)', () => {
    const sql = readFileSync(join(__dirname, '../../api/migrations/006_alerts.sql'), 'utf8');
    expect(sql).toMatch(/unique index if not exists alerts_event_id_idx on alerts \(kind, event_id\)/);
  });
});
