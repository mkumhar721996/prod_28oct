import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JackpotPoolCard } from "./JackpotPoolCard";

const jackpot = { miniCents: 200, minorCents: 150, majorCents: 100, grandCents: 50, totalCents: 500 };

describe("JackpotPoolCard", () => {
  const html = renderToStaticMarkup(<JackpotPoolCard jackpot={jackpot} />);

  it("AC6: shows the pool total in two decimals", () => {
    expect(html).toContain('<strong class="jackpot-total">5.00</strong>');
    expect(html).toContain('aria-label="Jackpot pool"');
  });

  it("AC7: lists Mini, Minor, Major and Grand in a split that starts hidden", () => {
    expect(html).toMatch(/<dl class="tiers"[^>]*hidden/);
    for (const [name, value] of [["Mini", "2.00"], ["Minor", "1.50"], ["Major", "1.00"], ["Grand", "0.50"]]) {
      expect(html).toContain(`<dt>${name}</dt><dd>${value}</dd>`);
    }
  });

  it("toggles the split from a ghost button that reports its state", () => {
    expect(html).toMatch(/<button[^>]*class="btn btn-ghost btn-sm"[^>]*aria-expanded="false"[^>]*>Show pool split</);
  });
});
