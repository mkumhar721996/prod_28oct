"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  canCover,
  formatAmount,
  insufficientMessage,
  resultMessage,
  spinOnce,
  type GameState,
  type JackpotCents,
  type SpinOutcome,
} from "@/lib/game";
import { BalanceTile } from "../BalanceTile";
import { Toast } from "../appointments/Toast";
import { Icon, type IconName } from "../orders/Icon";
import { BetSelector } from "./BetSelector";
import { JackpotPoolCard } from "./JackpotPoolCard";
import { ReelGrid } from "./ReelGrid";

/** The prototype's pacing: reels run at least this long, even when the API answers sooner. */
export const MIN_SPIN_MS = 1400;
const FRAME_MS = 120;
const DEFAULT_BET = 100;
/** Set before a spin request and cleared when it answers; still set on the next visit means the page was left mid-spin. */
const PENDING_KEY = "game.spin-pending";

type Tone = "success" | "info" | "danger";
type Notice = { tone: Tone; text: string };
export type GameViewState = {
  balance: number;
  bet: number;
  jackpot: JackpotCents;
  phase: "idle" | "spinning" | "result";
  reels: string[];
  notice: Notice | null;
  toast: boolean;
};

export type GameAction =
  | { type: "bet"; bet: number }
  | { type: "spin" }
  | { type: "settled"; outcome: Extract<SpinOutcome, { ok: true }> }
  | { type: "refused"; message?: string; balanceCredits?: number }
  | { type: "failed" }
  | { type: "welcome-back" }
  | { type: "toast-hidden" }
  | { type: "sync"; state: GameState };

const ICONS: Record<Tone, IconName> = { success: "check", info: "info", danger: "alert" };

export const initialView = (state: GameState): GameViewState => ({
  balance: state.balanceCredits,
  bet: DEFAULT_BET,
  jackpot: state.jackpot,
  phase: "idle",
  reels: ["cherry", "bell", "seven"],
  notice: null,
  toast: false,
});

const refusal = (view: GameViewState, text: string, balance = view.balance): GameViewState => ({
  ...view,
  phase: "idle",
  balance,
  notice: { tone: "danger", text },
  toast: true,
});

export function gameReducer(view: GameViewState, action: GameAction): GameViewState {
  switch (action.type) {
    case "bet":
      return { ...view, bet: action.bet };
    case "spin":
      if (view.phase === "spinning") return view;
      if (!canCover(view.balance, view.bet)) return refusal(view, insufficientMessage(view.balance, view.bet));
      return { ...view, phase: "spinning", notice: null, toast: false };
    case "settled": {
      const { outcome } = action;
      return {
        ...view,
        phase: "result",
        reels: outcome.reels,
        balance: outcome.balanceCredits,
        jackpot: outcome.jackpot,
        notice: resultMessage(outcome),
      };
    }
    case "refused": {
      const balance = action.balanceCredits ?? view.balance;
      return refusal(view, action.message ?? insufficientMessage(balance, view.bet), balance);
    }
    case "failed":
      return {
        ...view,
        phase: "idle",
        notice: { tone: "danger", text: "We couldn't confirm that spin. Your balance below is up to date." },
      };
    case "welcome-back":
      return {
        ...view,
        notice: {
          tone: "info",
          text: `Welcome back. Your last spin finished while you were away, and your balance shows ${formatAmount(view.balance)}.`,
        },
      };
    case "toast-hidden":
      return { ...view, toast: false };
    case "sync":
      return { ...view, balance: action.state.balanceCredits, jackpot: action.state.jackpot };
  }
}

/** One spin: waits for BOTH the API and the minimum pacing, then reports how it ended. */
export async function runSpin(
  deps: {
    spinOnce: (bet: number) => Promise<SpinOutcome>;
    wait: (ms: number) => Promise<void>;
    markPending: () => void;
    clearPending: () => void;
    refresh: () => void;
    dispatch: (action: GameAction) => void;
  },
  bet: number,
): Promise<void> {
  deps.markPending();
  const [outcome] = await Promise.all([deps.spinOnce(bet), deps.wait(MIN_SPIN_MS)]);
  deps.clearPending();
  if (outcome.ok) return deps.dispatch({ type: "settled", outcome });
  if (outcome.kind === "insufficient") {
    return deps.dispatch({ type: "refused", message: outcome.message, balanceCredits: outcome.balanceCredits });
  }
  deps.dispatch({ type: "failed" });
  deps.refresh();
}

export function GameView({
  view,
  frame,
  onBet,
  onSpin,
  onToastHidden,
}: {
  view: GameViewState;
  frame: number;
  onBet: (bet: number) => void;
  onSpin: () => void;
  onToastHidden: () => void;
}) {
  const spinning = view.phase === "spinning";
  return (
    <div className="stack stack-4 game">
      <div className="game-head">
        <h1 className="game-heading">Jackpot slots</h1>
        <BalanceTile credits={view.balance} variant="inline" />
      </div>
      <JackpotPoolCard jackpot={view.jackpot} />
      <ReelGrid symbols={view.reels} spinning={spinning} frame={frame} />
      <div className="result" role="status" aria-live="polite">
        {spinning ? (
          <span className="result-text">
            <span className="spinner" aria-hidden="true" /> Spinning… your balance updates when the reels stop
          </span>
        ) : view.notice ? (
          <div className={`alert alert-${view.notice.tone}`}>
            <Icon name={ICONS[view.notice.tone]} />
            <span>{view.notice.text}</span>
          </div>
        ) : (
          <span className="result-text">Place a bet and press Spin</span>
        )}
      </div>
      <BetSelector value={view.bet} onChange={onBet} disabled={spinning} />
      <button className="btn btn-primary btn-lg spin" type="button" disabled={spinning} onClick={onSpin}>
        {spinning ? (
          <>
            <span className="spinner" aria-hidden="true" /> Spinning
          </>
        ) : (
          "Spin"
        )}
      </button>
      {view.toast && (
        <Toast message="Your balance does not cover this bet" icon="alert" role="alert" onHide={onToastHidden} />
      )}
    </div>
  );
}

// localStorage can throw (private mode, blocked storage); the flag only drives a notice, so ignore that.
const pending = {
  mark: () => {
    try {
      localStorage.setItem(PENDING_KEY, "1");
    } catch {}
  },
  clear: () => {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {}
  },
  isSet: () => {
    try {
      return localStorage.getItem(PENDING_KEY) !== null;
    } catch {
      return false;
    }
  },
};

export function GameScreen({ initial }: { initial: GameState }) {
  const router = useRouter();
  const [view, dispatch] = useReducer(gameReducer, initial, initialView);
  const [frame, setFrame] = useState(0);
  const synced = useRef(initial);

  // A refreshed server render hands over a new `initial`; adopt it (the server is the source of truth).
  useEffect(() => {
    if (synced.current === initial) return;
    synced.current = initial;
    dispatch({ type: "sync", state: initial });
  }, [initial]);

  useEffect(() => {
    if (!pending.isSet()) return;
    pending.clear();
    dispatch({ type: "welcome-back" });
  }, []);

  const spinning = view.phase === "spinning";
  useEffect(() => {
    if (!spinning) return;
    const timer = setInterval(() => setFrame((f) => f + 1), FRAME_MS);
    return () => {
      clearInterval(timer);
      setFrame(0);
    };
  }, [spinning]);

  const hideToast = useCallback(() => dispatch({ type: "toast-hidden" }), []);

  function spin() {
    dispatch({ type: "spin" });
    if (!canCover(view.balance, view.bet)) return;
    void runSpin(
      {
        spinOnce,
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        markPending: pending.mark,
        clearPending: pending.clear,
        refresh: router.refresh,
        dispatch,
      },
      view.bet,
    );
  }

  return (
    <GameView
      view={view}
      frame={frame}
      onBet={(bet) => dispatch({ type: "bet", bet })}
      onSpin={spin}
      onToastHidden={hideToast}
    />
  );
}
