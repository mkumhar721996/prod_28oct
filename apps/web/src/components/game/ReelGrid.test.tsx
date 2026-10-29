// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReelGrid } from "./ReelGrid";

describe("ReelGrid", () => {
  it("AC2: shows each reel's symbol when stopped", () => {
    render(<ReelGrid symbols={["cherry", "bell", "bar"]} spinning={false} />);
    expect(screen.getAllByRole("img", { name: /^Reel \d$/ }).map((r) => r.textContent)).toEqual([
      "🍒",
      "🔔",
      "BAR",
    ]);
  });

  it("marks spinning reels", () => {
    render(<ReelGrid symbols={[]} spinning />);
    const reels = screen.getAllByRole("img", { name: /Reel \d spinning/ });
    expect(reels).toHaveLength(3);
    reels.forEach((r) => {
      expect(r).toHaveClass("is-spinning");
      expect(r).toHaveTextContent("?");
    });
  });

  it("renders a seven as 7", () => {
    render(<ReelGrid symbols={["seven", "seven", "seven"]} spinning={false} />);
    expect(screen.getAllByText("7")).toHaveLength(3);
  });
});
