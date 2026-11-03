import { MONEY_RECEIVED_QUEUE } from '../src/jobs/moneyReceived';

const work = jest.fn();
const createQueue = jest.fn();
const poolEnd = jest.fn();

jest.mock('pg-boss', () =>
  jest.fn().mockImplementation(() => ({ on: jest.fn(), start: jest.fn(), createQueue, work, schedule: jest.fn() })),
);
jest.mock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({ query: jest.fn(), end: poolEnd })) }));

import { startWorker } from '../src/worker';

describe('startWorker', () => {
  it('polls the money-received queue every second with retries', async () => {
    await startWorker({ databaseUrl: 'postgres://fake' });
    expect(createQueue).toHaveBeenCalledWith(MONEY_RECEIVED_QUEUE, { name: MONEY_RECEIVED_QUEUE, retryLimit: 5, retryBackoff: true });
    expect(work).toHaveBeenCalledWith(MONEY_RECEIVED_QUEUE, { pollingIntervalSeconds: 1 }, expect.any(Function));
  });
});
