import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Window = { count: number; resetAt: number };

/** In-memory fixed-window attempt counter (per API process); no extra dependency. */
@Injectable()
export class AttemptLimiter {
  static readonly WINDOW_MS = 15 * 60 * 1000;
  static readonly MAX_KEYS = 10_000;
  private readonly windows = new Map<string, Window>();

  /** Clock; a field (not a constructor argument) so Nest does not try to inject it. */
  now: () => number = Date.now;

  private current(key: string): Window | undefined {
    const w = this.windows.get(key);
    if (w && w.resetAt <= this.now()) {
      this.windows.delete(key);
      return undefined;
    }
    return w;
  }

  /** Throws 429 once `key` has used `limit` attempts in the window. */
  assertAllowed(key: string, limit: number): void {
    if ((this.current(key)?.count ?? 0) >= limit) {
      throw new HttpException(
        'Too many attempts. Try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  get size(): number {
    return this.windows.size;
  }

  /** Drops expired windows once the map is large, so unique keys cannot grow it without bound. */
  private sweep(): void {
    if (this.windows.size <= AttemptLimiter.MAX_KEYS) return;
    const t = this.now();
    for (const [key, w] of this.windows) if (w.resetAt <= t) this.windows.delete(key);
  }

  record(key: string): void {
    this.sweep();
    const w = this.current(key) ?? { count: 0, resetAt: this.now() + AttemptLimiter.WINDOW_MS };
    w.count += 1;
    this.windows.set(key, w);
  }

  /** Gives back one attempt (e.g. a reserved attempt that turned out to succeed). */
  release(key: string): void {
    const w = this.current(key);
    if (w) w.count = Math.max(0, w.count - 1);
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  clear(): void {
    this.windows.clear();
  }
}
