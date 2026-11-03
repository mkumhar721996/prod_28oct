"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { UNREAD_REFRESH_MS, fetchUnreadCount, startPolling } from "@/lib/alerts";

type UnreadCount = {
  /** Null until the first count arrives, and always when signed out. */
  count: number | null;
  setCount: (count: number) => void;
};

const UnreadCountContext = createContext<UnreadCount>({ count: null, setCount: () => undefined });

export function useUnreadCount(): UnreadCount {
  return useContext(UnreadCountContext);
}

/**
 * Polls the unread count while signed in. A failed poll keeps the last known count (no error for a
 * background refresh); the next tick tries again. Does nothing when signed out.
 */
export function startUnreadPolling(
  signedIn: boolean,
  setCount: (count: number) => void,
  isHidden: () => boolean,
  fetchCount: () => Promise<number> = fetchUnreadCount,
): () => void {
  if (!signedIn) return () => undefined;
  return startPolling(
    async () => {
      try {
        setCount(await fetchCount());
      } catch {
        // Keep the last known count.
      }
    },
    UNREAD_REFRESH_MS,
    isHidden,
  );
}

export function UnreadCountProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(
    () => startUnreadPolling(signedIn, setCount, () => document.hidden),
    [signedIn],
  );

  const value = useMemo(() => ({ count: signedIn ? count : null, setCount }), [signedIn, count]);
  return <UnreadCountContext.Provider value={value}>{children}</UnreadCountContext.Provider>;
}
