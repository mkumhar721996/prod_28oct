import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startUnreadPolling } from "./UnreadCountProvider";

describe("startUnreadPolling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the current count on mount", async () => {
    const setCount = vi.fn();
    startUnreadPolling(true, setCount, () => false, async () => 2);
    await vi.advanceTimersByTimeAsync(0);
    expect(setCount).toHaveBeenLastCalledWith(2);
  });

  it("shows the new count about 30 seconds later", async () => {
    let shown: number | null = null;
    const fetchCount = vi.fn().mockResolvedValueOnce(2).mockResolvedValue(3);
    startUnreadPolling(true, (n) => (shown = n), () => false, fetchCount);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(shown).toBe(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(shown).toBe(3);
  });

  it("keeps the last count when a poll fails and recovers on the next tick", async () => {
    let shown: number | null = null;
    const fetchCount = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue(4);
    startUnreadPolling(true, (n) => (shown = n), () => false, fetchCount);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(shown).toBe(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(shown).toBe(4);
  });

  it("does not fetch while the tab is hidden", async () => {
    const fetchCount = vi.fn(async () => 1);
    startUnreadPolling(true, vi.fn(), () => true, fetchCount);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetchCount).not.toHaveBeenCalled();
  });

  it("does not fetch when signed out", async () => {
    const fetchCount = vi.fn(async () => 1);
    startUnreadPolling(false, vi.fn(), () => false, fetchCount);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetchCount).not.toHaveBeenCalled();
  });

  it("stops polling when stopped", async () => {
    const fetchCount = vi.fn(async () => 1);
    const stop = startUnreadPolling(true, vi.fn(), () => false, fetchCount);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetchCount).toHaveBeenCalledTimes(1);
  });
});
