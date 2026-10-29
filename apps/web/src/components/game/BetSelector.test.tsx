// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BetSelector } from "./BetSelector";

describe("BetSelector", () => {
  it("AC1: offers the five bets and checks the selected one", () => {
    render(<BetSelector value={250} onChange={() => {}} />);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual([
      "10",
      "25",
      "50",
      "100",
      "250",
    ]);
    expect(screen.getByRole("radio", { name: "250" })).toBeChecked();
  });

  it("reports the chosen bet", async () => {
    const onChange = vi.fn();
    render(<BetSelector value={100} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "25" }));
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it("disables every option while spinning", () => {
    render(<BetSelector value={100} onChange={() => {}} disabled />);
    screen.getAllByRole("radio").forEach((r) => expect(r).toBeDisabled());
  });
});
