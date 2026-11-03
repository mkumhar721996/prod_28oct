"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { cardReducer, loadCard, type CardAction, type CardState } from "@/lib/stocks";

/**
 * One card's load state. `initial` renders a given state without effects (tests); otherwise the
 * first load starts once on mount. `load` is also the retry.
 */
export function useCard<T>(fetcher: () => Promise<T>, initial?: CardState<T>) {
  const [state, dispatch] = useReducer(
    (s: CardState<T>, a: CardAction<T>) => cardReducer(s, a),
    initial ?? { status: "loading" },
  );
  const started = useRef(initial !== undefined);

  const load = useCallback(() => {
    void loadCard(fetcher, dispatch);
  }, [fetcher]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
  }, [load]);

  return [state, load] as const;
}
