"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { canCover, resultMessage, spinOnce, type GameState } from "@/lib/game";
import { BalanceTile } from "../BalanceTile";
import { Toast } from "../appointments/Toast";
import { Icon, type IconName } from "../orders/Icon";
import { BetSelector } from "./BetSelector";
import { JackpotPoolCard } from "./JackpotPoolCard";
import { ReelGrid } from "./ReelGrid";

/** Set before the request and cleared when it settles, so a page closed mid-spin is noticed on return. */
export const PENDING_SPIN_KEY = "game:spin-pending";
export const MIN_SPIN_MS = 1400;
const CYCLE_MS = 120;
const CYCLE_SYMBOLS = ["cherry", "bell", "bar", "seven"];
const DEFAULT_BET = 100;

type Notice = { tone: "success" | "info" | "danger"; icon: IconName; text: string };
type Phase = "idle" | "spinning" | "result";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function GameScreen({ initial }: { initial: GameState }) {
  const router = useRouter();
  const [balance, setBalance] = useState(initial.balanceCredits);
  const [jackpot, setJackpot] = useState(initial.jackpot);
  const [bet, setBet] = useState<number>(DEFAULT_BET);
  const [phase, setPhase] = useState<Phase>("idle");
  const [reels, setReels] = useState<string[]>(["cherry", "bell", "seven"]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [toast, setToast] = useState(false);
  const [tick, setTick] = useState(0);
  const hideToast = useCallback(() => setToast(false), []);
  const welcomed = useRef(false);

  // router.refresh() re-renders the page with fresh server values; state seeded from props must follow.
  useEffect(() => {
    setBalance(initial.balanceCredits);
    setJackpot(initial.jackpot);
  }, [initial]);

  // A flag still set on arrival means the last spin's page was closed before its response came back.
  useEffect(() => {
    if (welcomed.current) return;
    welcomed.current = true;
    if (window.localStorage.getItem(PENDING_SPIN_KEY)) {
      window.localStorage.removeItem(PENDING_SPIN_KEY);
      setNotice({
        tone: "info",
        icon: "info",
        text: `Welcome back. Your last spin finished while you were away, and your balance shows ${initial.balanceCredits.toLocaleString("en-US")}.`,
      });
    }
  }, [initial.balanceCredits]);

  useEffect(() => {
    if (phase !== "spinning") return;
    const timer = setInterval(() => setTick((t) => t + 1), CYCLE_MS);
    return () => clearInterval(timer);
  }, [phase]);

  async function spin() {
    if (!canCover(balance, bet)) {
      setNotice({
        tone: "danger",
        icon: "alert",
        text: `Your balance of ${balance.toLocaleString("en-US")} does not cover a bet of ${bet}. Choose a lower bet.`,
      });
      setToast(true);
      return;
    }
    setToast(false);
    setNotice(null);
    setPhase("spinning");
    window.localStorage.setItem(PENDING_SPIN_KEY, "1");
    const [outcome] = await Promise.all([spinOnce(bet), wait(MIN_SPIN_MS)]);
    window.localStorage.removeItem(PENDING_SPIN_KEY);
    if (outcome.ok) {
      setReels(outcome.reels);
      setBalance(outcome.balanceCredits);
      setJackpot(outcome.jackpot);
      const msg = resultMessage(outcome);
      setNotice({ tone: msg.tone, icon: msg.tone === "success" ? "check" : "info", text: msg.text });
    } else if (outcome.kind === "insufficient") {
      if (outcome.balanceCredits !== undefined) setBalance(outcome.balanceCredits);
      setNotice({ tone: "danger", icon: "alert", text: outcome.message ?? "Your balance does not cover this bet." });
      router.refresh();
    } else {
      setNotice({
        tone: "danger",
        icon: "alert",
        text: "We couldn't confirm that spin. Your balance below is up to date.",
      });
      router.refresh();
    }
    setPhase("result");
  }

  const spinning = phase === "spinning";
  const shown = spinning ? [0, 1, 2].map((i) => CYCLE_SYMBOLS[(tick + i) % CYCLE_SYMBOLS.length]) : reels;

  return (
    <div className="stack stack-4 game">
      <div className="game-head">
        <h1 className="game-heading">Jackpot slots</h1>
        <BalanceTile credits={balance} variant="inline" />
      </div>
      <JackpotPoolCard jackpot={jackpot} />
      <ReelGrid symbols={shown} spinning={spinning} />
      <div className="result" role="status" aria-live="polite">
        {spinning ? (
          <span className="result-text">
            <span className="spinner" aria-hidden="true" /> Spinning… your balance updates when the reels stop
          </span>
        ) : notice ? (
          <div className={`alert alert-${notice.tone}`}>
            <Icon name={notice.icon} /> <span>{notice.text}</span>
          </div>
        ) : (
          <span className="result-text">Place a bet and press Spin</span>
        )}
      </div>
      <BetSelector value={bet} onChange={setBet} disabled={spinning} />
      <button className="btn btn-primary btn-lg spin" type="button" disabled={spinning} onClick={spin}>
        {spinning ? (
          <>
            <span className="spinner" aria-hidden="true" /> Spinning
          </>
        ) : (
          "Spin"
        )}
      </button>
      {toast && (
        <Toast message="Your balance does not cover this bet" icon="alert" role="alert" onHide={hideToast} />
      )}
    </div>
  );
}
