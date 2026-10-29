// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { JackpotPoolCard } from "./JackpotPoolCard";

const jackpot = { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 };

describe("JackpotPoolCard", () => {
  it("AC6: shows the pool total in credits", () => {
    render(<JackpotPoolCard jackpot={jackpot} />);
    expect(screen.getByText("5.00")).toBeInTheDocument();
  });

  it("AC7: toggles the Mini, Minor, Major and Grand split", async () => {
    render(<JackpotPoolCard jackpot={jackpot} />);
    const toggle = screen.getByRole("button", { name: "Show pool split" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("1.50")).not.toBeVisible();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const text of ["Mini", "Minor", "Major", "Grand", "2.00", "1.50", "1.00", "0.50"]) {
      expect(screen.getByText(text)).toBeVisible();
    }
  });
});
