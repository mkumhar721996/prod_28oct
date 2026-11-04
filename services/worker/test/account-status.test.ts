import { jobs } from '../src/jobs';
import {
  ACCOUNT_FROZEN_QUEUE,
  ACCOUNT_UNFROZEN_QUEUE,
  handleAccountFrozen,
  handleAccountUnfrozen,
} from '../src/jobs/account-status';

describe.each([
  ['account_frozen', 'evt_f1', handleAccountFrozen, ACCOUNT_FROZEN_QUEUE],
  ['account_unfrozen', 'evt_u1', handleAccountUnfrozen, ACCOUNT_UNFROZEN_QUEUE],
])('%s', (kind, eventId, handle, queue) => {
  const evt = { eventId, playerId: 'p1' };

  it('inserts one alert of the kind', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    await expect(handle(evt, db)).resolves.toEqual({ created: true });
    expect(db.query.mock.calls[0][0]).toContain(`'${kind}'`);
    expect(db.query.mock.calls[0][1]).toEqual(['p1', eventId]);
  });

  it('treats a duplicate event as a no-op', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
    await expect(handle(evt, db)).resolves.toEqual({ created: false });
    expect(db.query.mock.calls[0][0]).toMatch(/on conflict \(kind, event_id\) do nothing/i);
  });

  it.each([{ eventId: '' }, { playerId: '' }])('rejects a bad payload %o without querying', async (bad) => {
    const db = { query: jest.fn() };
    await expect(handle({ ...evt, ...bad }, db)).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('registers the queue with retries', () => {
    expect(jobs.find((j) => j.name === queue)?.retryLimit).toBeGreaterThan(0);
  });
});
