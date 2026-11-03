"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** null = the balance could not be loaded. */
export type BalanceState = number | null;

type BalanceContextValue = { balance: BalanceState; setBalance: (credits: number) => void };

const BalanceContext = createContext<BalanceContextValue | null>(null);

/** A published balance replaces whatever was there, including the unavailable state. */
export const nextBalance = (_current: BalanceState, published: number): BalanceState => published;

export function BalanceProvider({
  initial,
  children,
}: {
  initial: BalanceState;
  children: React.ReactNode;
}) {
  const [balance, setState] = useState<BalanceState>(initial);
  const [seen, setSeen] = useState<BalanceState>(initial);
  // A router.refresh() re-renders the layout with a fresh server value: adopt it.
  if (seen !== initial) {
    setSeen(initial);
    setState(initial);
  }
  const setBalance = useCallback(
    (credits: number) => setState((current) => nextBalance(current, credits)),
    [],
  );
  const value = useMemo(() => ({ balance, setBalance }), [balance, setBalance]);
  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
}

export function useBalance(): BalanceContextValue {
  const value = useContext(BalanceContext);
  if (!value) throw new Error("useBalance must be used inside BalanceProvider");
  return value;
}
