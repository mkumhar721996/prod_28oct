// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spinOnce, refresh } = vi.hoisted(() => ({ spinOnce: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/game", async (orig) => ({ ...(await orig<typeof import("@/lib/game")>()), spinOnce }));

import { GameScreen, PENDING_SPIN_KEY } from "./GameScreen";

const jackpot = { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 };
const jackpotAfter = { miniCents: 400, minorCents: 300, majorCents: 200, grandCents: 100, totalCents: 1000 };
const win = {
  ok: true,
  reels: ["cherry", "cherry", "bar"],
  bet: 100,
  winCredits: 100,
  label: "Two cherries pay 1× your bet.",
  balanceCredits: 1000,
  jackpot: jackpotAfter,
};
const loss = { ...win, reels: ["bar", "bell", "seven"], winCredits: 0, label: null, balanceCredits: 900 };

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  // shouldAdvanceTime lets testing-library's own polling run under fake timers.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  window.localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

const open = (balanceCredits = 1000) => render(<GameScreen initial={{ balanceCredits, jackpot }} />);
const finishSpin = () => act(() => vi.advanceTimersByTimeAsync(1400));

describe("GameScreen", () => {
  it("AC1: defaults to 100 and selects 250", async () => {
    open();
    expect(screen.getByRole("radio", { name: "100" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "250" }));
    expect(screen.getByRole("radio", { name: "250" })).toBeChecked();
  });

  it("AC2: spins three reels, then shows the server's symbols", async () => {
    spinOnce.mockResolvedValue(win);
    open();
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(screen.getAllByRole("img", { name: /Reel \d spinning/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Spinning/ })).toBeDisabled();
    await finishSpin();
    expect(screen.getAllByRole("img", { name: /^Reel \d$/ }).map((r) => r.textContent)).toEqual([
      "🍒",
      "🍒",
      "BAR",
    ]);
    expect(spinOnce).toHaveBeenCalledWith(100);
  });

  it("AC3: shows a win message", async () => {
    spinOnce.mockResolvedValue(win);
    open();
    await user.click(screen.getByRole("button", { name: "Spin" }));
    await finishSpin();
    expect(screen.getByText(/You win 100/)).toBeInTheDocument();
  });

  it("AC4: shows a loss message", async () => {
    spinOnce.mockResolvedValue(loss);
    open();
    await user.click(screen.getByRole("button", { name: "Spin" }));
    await finishSpin();
    expect(screen.getByText(/No win this time/)).toBeInTheDocument();
  });

  it("AC5/AC6: keeps the old balance until the reels stop, then shows balance and pool", async () => {
    spinOnce.mockResolvedValue(loss);
    open();
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("5.00")).toBeInTheDocument();
    await finishSpin();
    expect(screen.getByText("900")).toBeInTheDocument();
    expect(screen.getByText("10.00")).toBeInTheDocument();
  });

  it("waits for the minimum spin time even when the answer is instant", async () => {
    spinOnce.mockResolvedValue(loss);
    open();
    await user.click(screen.getByRole("button", { name: "Spin" }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getAllByRole("img", { name: /spinning/ })).toHaveLength(3);
  });

  it("AC8: welcomes the player back when a spin was left pending, and clears the flag", () => {
    window.localStorage.setItem(PENDING_SPIN_KEY, "1");
    open(900);
    expect(screen.getByText(/Welcome back/)).toHaveTextContent("your balance shows 900");
    expect(window.localStorage.getItem(PENDING_SPIN_KEY)).toBeNull();
  });

  it("AC8: sets the flag during the request and clears it after", async () => {
    spinOnce.mockResolvedValue(loss);
    open();
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(window.localStorage.getItem(PENDING_SPIN_KEY)).toBe("1");
    await finishSpin();
    expect(window.localStorage.getItem(PENDING_SPIN_KEY)).toBeNull();
  });

  it("AC8: a request that fails shows an alert and refreshes the balance", async () => {
    spinOnce.mockResolvedValue({ ok: false, kind: "failed" });
    open();
    await user.click(screen.getByRole("button", { name: "Spin" }));
    await finishSpin();
    expect(screen.getByText(/We couldn't confirm that spin/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("AC9: does not spin when the balance is below the bet, and the bet stays", async () => {
    open(90);
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(spinOnce).not.toHaveBeenCalled();
    expect(screen.queryByRole("img", { name: /spinning/ })).toBeNull();
    expect(screen.getByRole("radio", { name: "100" })).toBeChecked();
  });

  it("AC9: a balance equal to the bet does spin", async () => {
    spinOnce.mockResolvedValue({ ...loss, balanceCredits: 0 });
    open(100);
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(spinOnce).toHaveBeenCalledWith(100);
  });

  it("AC10: refuses a bet of 250 on a balance of 100 with a message and a toast", async () => {
    open(100);
    await user.click(screen.getByRole("radio", { name: "250" }));
    await user.click(screen.getByRole("button", { name: "Spin" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your balance of 100 does not cover a bet of 250. Choose a lower bet.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Your balance does not cover this bet");
    expect(spinOnce).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
