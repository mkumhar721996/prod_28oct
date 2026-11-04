import { jobs } from '../src/jobs';
import {
  IDENTITY_VERIFICATION_RESULT_QUEUE,
  IdentityVerificationResultEvent,
  handleIdentityVerificationResult,
} from '../src/jobs/identity-verification-result';

const evt: IdentityVerificationResultEvent = { eventId: 'evt_i1', playerId: 'p1', result: 'approved' };

describe('handleIdentityVerificationResult', () => {
  it('inserts one alert carrying the result', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    await expect(handleIdentityVerificationResult(evt, db)).resolves.toEqual({ created: true });
    expect(db.query.mock.calls[0][0]).toContain("'identity_verification_result'");
    expect(db.query.mock.calls[0][1]).toEqual(['p1', 'evt_i1', 'approved']);
  });

  it('treats a duplicate event as a no-op', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
    await expect(handleIdentityVerificationResult(evt, db)).resolves.toEqual({ created: false });
    expect(db.query.mock.calls[0][0]).toMatch(/on conflict \(kind, event_id\) do nothing/i);
  });

  it.each([{ result: 'maybe' as never }, { eventId: '' }, { playerId: '' }])(
    'rejects a bad payload %o without querying',
    async (bad) => {
      const db = { query: jest.fn() };
      await expect(handleIdentityVerificationResult({ ...evt, ...bad }, db)).rejects.toThrow();
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  it('registers the queue with retries', () => {
    expect(jobs.find((j) => j.name === IDENTITY_VERIFICATION_RESULT_QUEUE)?.retryLimit).toBeGreaterThan(0);
  });
});
