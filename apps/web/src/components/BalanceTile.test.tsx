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

  it("keeps the card output by default", () => {
    const html = renderToStaticMarkup(<BalanceTile credits={1000} email="a@b.co" />);
    expect(html).toContain('class="card balance-tile"');
    expect(html).toContain(">1,000 credits<");
  });

  it("renders the compact balance box inline", () => {
    const html = renderToStaticMarkup(<BalanceTile credits={1000} variant="inline" />);
    expect(html).toContain('class="balance-box"');
    expect(html).toContain('<strong aria-live="polite">1,000</strong>');
  });
});
