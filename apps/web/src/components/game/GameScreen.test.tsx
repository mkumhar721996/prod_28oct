import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GameState, SpinOutcome } from "@/lib/game";
import { MIN_SPIN_MS, GameView, gameReducer, initialView, runSpin, type GameAction } from "./GameScreen";

const jackpot = { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 };
const game = (balanceCredits: number): GameState => ({ balanceCredits, jackpot });
const apply = (actions: GameAction[], from = initialView(game(1000))) => actions.reduce(gameReducer, from);

const win: Extract<SpinOutcome, { ok: true }> = {
  ok: true,
  reels: ["cherry", "cherry", "bar"],
  bet: 100,
  winCredits: 100,
  label: "Two cherries pay 1× your bet.",
  balanceCredits: 1000,
  jackpot: { miniCents: 400, minorCents: 300, majorCents: 200, grandCents: 100, totalCents: 1000 },
};
const loss: Extract<SpinOutcome, { ok: true }> = {
  ...win,
  reels: ["bar", "seven", "bell"],
  winCredits: 0,
  label: null,
  balanceCredits: 900,
};

describe("gameReducer", () => {
  it("AC1: starts on a bet of 100 and selects 250", () => {
    expect(initialView(game(1000)).bet).toBe(100);
    expect(apply([{ type: "bet", bet: 250 }]).bet).toBe(250);
  });

  it("AC2: spinning keeps the old balance until the reels stop", () => {
    const view = apply([{ type: "spin" }]);
    expect(view.phase).toBe("spinning");
    expect(view.balance).toBe(1000);
  });

  it("AC3/AC5/AC6: a win shows the win message, the new balance and the new pool", () => {
    const view = apply([{ type: "spin" }, { type: "settled", outcome: win }]);
    expect(view).toMatchObject({ phase: "result", reels: win.reels, balance: 1000, jackpot: win.jackpot });
    expect(view.notice).toEqual({ tone: "success", text: "You win 100. Two cherries pay 1× your bet." });
  });

  it("AC4/AC5: a loss shows the loss message and balance minus the bet", () => {
    const view = apply([{ type: "spin" }, { type: "settled", outcome: loss }]);
    expect(view.balance).toBe(900);
    expect(view.notice).toEqual({ tone: "info", text: "No win this time. You bet 100. Try again." });
  });

  it("AC9: a balance below the bet does not spin and keeps the bet", () => {
    const view = apply([{ type: "spin" }], initialView(game(90)));
    expect(view.phase).toBe("idle");
    expect(view.bet).toBe(100);
    expect(view.toast).toBe(true);
    expect(view.reels).toEqual(initialView(game(90)).reels);
  });

  it("AC10: balance 100 and bet 250 shows the does-not-cover message", () => {
    const view = apply([{ type: "bet", bet: 250 }, { type: "spin" }], initialView(game(100)));
    expect(view.phase).toBe("idle");
    expect(view.notice).toEqual({
      tone: "danger",
      text: "Your balance of 100 does not cover a bet of 250. Choose a lower bet.",
    });
    expect(view.toast).toBe(true);
    expect(apply([{ type: "toast-hidden" }], view).toast).toBe(false);
  });

  it("a server refusal stops the reels, adopts the server balance and keeps the bet", () => {
    const view = apply([
      { type: "spin" },
      { type: "refused", message: "Your balance of 40 does not cover a bet of 100. Choose a lower bet.", balanceCredits: 40 },
    ]);
    expect(view).toMatchObject({ phase: "idle", balance: 40, bet: 100, toast: true });
    expect(view.notice?.tone).toBe("danger");
  });

  it("AC8: a returning player is told the balance shown is the settled one", () => {
    const view = apply([{ type: "welcome-back" }], initialView(game(900)));
    expect(view.notice).toEqual({
      tone: "info",
      text: "Welcome back. Your last spin finished while you were away, and your balance shows 900.",
    });
  });

  it("AC8: an unconfirmed spin says the balance is up to date", () => {
    const view = apply([{ type: "spin" }, { type: "failed" }]);
    expect(view.phase).toBe("idle");
    expect(view.notice).toEqual({
      tone: "danger",
      text: "We couldn't confirm that spin. Your balance below is up to date.",
    });
  });

  it("syncs balance and pool from refreshed server data", () => {
    const view = apply([{ type: "sync", state: { balanceCredits: 777, jackpot: win.jackpot } }]);
    expect(view).toMatchObject({ balance: 777, jackpot: win.jackpot });
  });
});

describe("runSpin", () => {
  const deps = (outcome: SpinOutcome) => ({
    spinOnce: vi.fn(async () => outcome),
    wait: vi.fn(async () => undefined),
    markPending: vi.fn(),
    clearPending: vi.fn(),
    refresh: vi.fn(),
    dispatch: vi.fn(),
  });

  it("AC2: spins the chosen bet, waits the minimum pacing, then settles", async () => {
    const d = deps(win);
    await runSpin(d, 100);
    expect(d.spinOnce).toHaveBeenCalledWith(100);
    expect(d.wait).toHaveBeenCalledWith(MIN_SPIN_MS);
    expect(d.markPending).toHaveBeenCalledBefore(d.spinOnce);
    expect(d.clearPending).toHaveBeenCalled();
    expect(d.dispatch).toHaveBeenCalledWith({ type: "settled", outcome: win });
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it("AC10: passes a server refusal through", async () => {
    const outcome: SpinOutcome = { ok: false, kind: "insufficient", message: "no", balanceCredits: 100 };
    const d = deps(outcome);
    await runSpin(d, 250);
    expect(d.dispatch).toHaveBeenCalledWith({ type: "refused", message: "no", balanceCredits: 100 });
  });

  it("AC8: a failed request shows the failure and refreshes the server data", async () => {
    const d = deps({ ok: false, kind: "failed" });
    await runSpin(d, 100);
    expect(d.dispatch).toHaveBeenCalledWith({ type: "failed" });
    expect(d.refresh).toHaveBeenCalled();
  });
});

describe("GameView", () => {
  const render = (view = initialView(game(1000))) =>
    renderToStaticMarkup(<GameView view={view} frame={0} onBet={() => undefined} onSpin={() => undefined} onToastHidden={() => undefined} />);

  it("shows the balance, the pool, the reels, the bet and one primary Spin button", () => {
    const html = render();
    expect(html).toContain("Jackpot slots");
    expect(html).toContain('<strong aria-live="polite">1,000</strong>');
    expect(html).toContain('<strong class="jackpot-total">5.00</strong>');
    expect(html).toContain('<input type="radio" name="bet" checked="" value="100"/>');
    expect(html).toMatch(/<button[^>]*class="btn btn-primary btn-lg spin"[^>]*>Spin<\/button>/);
    expect(html.match(/btn-primary/g)).toHaveLength(1);
    expect(html).toContain("Place a bet and press Spin");
  });

  it("AC2: while spinning the bet and button are disabled and the reels are marked", () => {
    const html = render(apply([{ type: "spin" }]));
    expect(html).toContain("Reel 1 spinning");
    expect(html).toContain('<fieldset class="bet" disabled="">');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*><span class="spinner"[^>]*><\/span> Spinning<\/button>/);
    expect(html).toContain("your balance updates when the reels stop");
  });

  it("AC3/AC4: win and loss are told apart by text and icon, in a polite status region", () => {
    const won = render(apply([{ type: "spin" }, { type: "settled", outcome: win }]));
    expect(won).toContain('class="alert alert-success"');
    expect(won).toContain("You win 100. Two cherries pay 1× your bet.");
    expect(won).toContain('role="status" aria-live="polite"');
    const lost = render(apply([{ type: "spin" }, { type: "settled", outcome: loss }]));
    expect(lost).toContain('class="alert alert-info"');
    expect(lost).toContain("No win this time. You bet 100. Try again.");
  });

  it("AC10: the refusal shows a danger alert and an alert toast", () => {
    const html = render(apply([{ type: "bet", bet: 250 }, { type: "spin" }], initialView(game(100))));
    expect(html).toContain('class="alert alert-danger"');
    expect(html).toContain("Your balance of 100 does not cover a bet of 250. Choose a lower bet.");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your balance does not cover this bet");
  });
});
