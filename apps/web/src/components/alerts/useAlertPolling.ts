"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALERTS_CHANGED_EVENT,
  ALERTS_POLL_MS,
  UNREAD_POLL_MS,
  fetchAlerts,
  fetchUnreadCount,
  type Alert,
} from "@/lib/alerts";

type PollResult<T> = { ok: true; value: T } | { ok: false };

type PollingDeps<T> = {
  intervalMs: number;
  fetchOnce: () => Promise<PollResult<T>>;
  onValue: (value: T) => void;
  isHidden: () => boolean;
};

/**
 * Polls on an interval, skipping ticks while the tab is hidden. A failed poll reports nothing, so the
 * caller keeps its last value. The returned function stops it; a result landing after that is dropped.
 */
export function startPolling<T>({ intervalMs, fetchOnce, onValue, isHidden }: PollingDeps<T>): () => void {
  let stopped = false;
  const timer = setInterval(async () => {
    if (isHidden()) return;
    const result = await fetchOnce();
    if (!stopped && result.ok) onValue(result.value);
  }, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

function usePolling<T>(
  intervalMs: number,
  fetchOnce: () => Promise<PollResult<T>>,
  initial: T,
  enabled = true,
): [T, (value: T) => void, () => Promise<void>] {
  const [value, setValue] = useState<T>(initial);
  const fetchRef = useRef(fetchOnce);
  fetchRef.current = fetchOnce;

  useEffect(() => {
    if (!enabled) return;
    // Read once on mount so the badge does not wait a full interval to appear.
    void fetchRef.current().then((r) => r.ok && setValue(r.value));
    return startPolling({
      intervalMs,
      fetchOnce: () => fetchRef.current(),
      onValue: setValue,
      isHidden: () => document.hidden,
    });
  }, [intervalMs, enabled]);

  // Re-read straight away when an alert changes elsewhere on the page (e.g. marked read).
  useEffect(() => {
    if (!enabled) return;
    const onChanged = () => void fetchRef.current().then((r) => r.ok && setValue(r.value));
    window.addEventListener(ALERTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(ALERTS_CHANGED_EVENT, onChanged);
  }, [enabled]);

  const refresh = useCallback(async () => {
    const result = await fetchRef.current();
    if (result.ok) setValue(result.value);
  }, []);

  return [value, setValue, refresh];
}

/** The top-bar unread count; null until the first successful read. */
export function useUnreadCount(enabled = true): number | null {
  const [count] = usePolling<number | null>(
    UNREAD_POLL_MS,
    async () => {
      const r = await fetchUnreadCount();
      return r.ok ? { ok: true, value: r.unreadCount } : { ok: false };
    },
    null,
    enabled,
  );
  return count;
}

/** The open alerts list, polled fast enough that a new alert shows within 10s. */
export function useAlertsList(initial: Alert[]) {
  const [alerts, setAlerts, refresh] = usePolling<Alert[]>(
    ALERTS_POLL_MS,
    async () => {
      const r = await fetchAlerts();
      return r.ok ? { ok: true, value: r.alerts } : { ok: false };
    },
    initial,
  );
  return { alerts, setAlerts, refresh };
}
