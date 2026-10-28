import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BalanceTile, formatCredits } from "./BalanceTile";

describe("formatCredits", () => {
  it.each([
    [1, "1 credit"],
    [0, "0 credits"],
    [2, "2 credits"],
    [500, "500 credits"],
    [1000, "1,000 credits"],
  ])("formats %i as %s", (n, text) => {
    expect(formatCredits(n)).toBe(text);
  });
});

describe("BalanceTile", () => {
  it("says '1 credit' for a balance of 1", () => {
    expect(renderToStaticMarkup(<BalanceTile credits={1} />)).toContain(">1 credit<");
  });
});
