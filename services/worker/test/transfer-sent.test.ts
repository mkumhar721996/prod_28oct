import { jobs } from '../src/jobs';
import { TRANSFER_SENT_QUEUE, TransferSentEvent, handleTransferSent } from '../src/jobs/transfer-sent';

const evt: TransferSentEvent = {
  eventId: 'evt_t1',
  senderPlayerId: 'p1',
  amountMinor: 5000,
  currency: 'USD',
  recipientName: 'Ada Lee',
};

describe('handleTransferSent', () => {
  it('inserts one transfer_sent alert', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    await expect(handleTransferSent(evt, db)).resolves.toEqual({ created: true });
    expect(db.query.mock.calls[0][0]).toMatch(/insert into alerts/i);
    expect(db.query.mock.calls[0][0]).toMatch(/'transfer_sent'/);
    expect(db.query.mock.calls[0][1]).toEqual(['p1', 'evt_t1', 5000, 'USD', 'Ada Lee']);
  });

  it('treats a duplicate event as a no-op', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
    await expect(handleTransferSent(evt, db)).resolves.toEqual({ created: false });
    expect(db.query.mock.calls[0][0]).toMatch(/on conflict \(kind, event_id\) do nothing/i);
  });

  it.each([{ amountMinor: 0 }, { amountMinor: 1.5 }, { eventId: '' }, { senderPlayerId: '' }, { recipientName: '' }, { currency: '' }])(
    'rejects a bad payload %o without querying',
    async (bad) => {
      const db = { query: jest.fn() };
      await expect(handleTransferSent({ ...evt, ...bad }, db)).rejects.toThrow();
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  it('registers the queue with retries', () => {
    expect(jobs.find((j) => j.name === TRANSFER_SENT_QUEUE)?.retryLimit).toBeGreaterThan(0);
  });
});
