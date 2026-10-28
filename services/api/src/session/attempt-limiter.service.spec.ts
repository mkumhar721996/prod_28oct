import { HttpException } from '@nestjs/common';
import { AttemptLimiter } from './attempt-limiter.service';

describe('AttemptLimiter', () => {
  let now = 0;
  const limiter = new AttemptLimiter();
  limiter.now = () => now;

  beforeEach(() => {
    now = 0;
    limiter.clear();
  });

  it('allows attempts below the limit', () => {
    for (let i = 0; i < 4; i++) limiter.record('k');
    expect(() => limiter.assertAllowed('k', 5)).not.toThrow();
  });

  it('refuses with 429 once the limit is reached', () => {
    for (let i = 0; i < 5; i++) limiter.record('k');
    expect(() => limiter.assertAllowed('k', 5)).toThrow(HttpException);
    try {
      limiter.assertAllowed('k', 5);
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(429);
    }
  });

  it('forgets attempts after the window', () => {
    for (let i = 0; i < 5; i++) limiter.record('k');
    now += AttemptLimiter.WINDOW_MS + 1;
    expect(() => limiter.assertAllowed('k', 5)).not.toThrow();
  });

  it('release gives one attempt back and never goes below zero', () => {
    limiter.record('k');
    limiter.record('k');
    limiter.release('k');
    for (let i = 0; i < 3; i++) limiter.release('k');
    for (let i = 0; i < 4; i++) limiter.record('k');
    expect(() => limiter.assertAllowed('k', 5)).not.toThrow();
  });

  it('reset clears a key', () => {
    for (let i = 0; i < 5; i++) limiter.record('k');
    limiter.reset('k');
    expect(() => limiter.assertAllowed('k', 5)).not.toThrow();
  });
});
