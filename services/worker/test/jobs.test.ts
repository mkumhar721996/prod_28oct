import { jobs, handleNotification, NOTIFICATIONS_QUEUE } from '../src/jobs';

describe('jobs', () => {
  it('registers the notifications queue', () => {
    expect(jobs.map((j) => j.name)).toContain(NOTIFICATIONS_QUEUE);
  });

  it('handles a notification', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await handleNotification({ recipient: 'a@example.com' });
    expect(spy).toHaveBeenCalledWith('notification handled for a@example.com');
    spy.mockRestore();
  });
});
