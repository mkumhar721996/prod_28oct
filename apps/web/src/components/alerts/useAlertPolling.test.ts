import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPolling } from "./useAlertPolling";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type Result = { ok: true; value: number } | { ok: false };

function setup(results: Result[], hidden = () => false) {
  const values: number[] = [];
  const fetchOnce = vi.fn(async () => results.shift() ?? ({ ok: false } as Result));
  const stop = startPolling({
    intervalMs: 1000,
    fetchOnce,
    onValue: (v) => values.push(v),
    isHidden: hidden,
  });
  return { values, fetchOnce, stop };
}

describe("startPolling", () => {
  it("fetches on every interval and reports each value", async () => {
    const { values, fetchOnce } = setup([
      { ok: true, value: 1 },
      { ok: true, value: 2 },
    ]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchOnce).toHaveBeenCalledTimes(2);
    expect(values).toEqual([1, 2]);
  });

  it("keeps the last value when a poll fails", async () => {
    const { values } = setup([{ ok: true, value: 4 }, { ok: false }]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(values).toEqual([4]);
  });

  it("skips ticks while the tab is hidden", async () => {
    let hidden = true;
    const { fetchOnce } = setup([{ ok: true, value: 1 }], () => hidden);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchOnce).not.toHaveBeenCalled();
    hidden = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it("stops polling and drops late results after stop()", async () => {
    const { values, fetchOnce, stop } = setup([{ ok: true, value: 1 }]);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchOnce).not.toHaveBeenCalled();
    expect(values).toEqual([]);
  });

  it("ignores an in-flight result that lands after stop()", async () => {
    let resolve!: (r: Result) => void;
    const values: number[] = [];
    const stop = startPolling({
      intervalMs: 1000,
      fetchOnce: () => new Promise<Result>((r) => (resolve = r)),
      onValue: (v) => values.push(v),
      isHidden: () => false,
    });
    await vi.advanceTimersByTimeAsync(1000);
    stop();
    resolve({ ok: true, value: 9 });
    await vi.advanceTimersByTimeAsync(0);
    expect(values).toEqual([]);
  });
});
