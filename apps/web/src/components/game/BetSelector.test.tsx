import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BetSelector } from "./BetSelector";

const render = (value: number, disabled = false) =>
  renderToStaticMarkup(<BetSelector value={value} onChange={() => undefined} disabled={disabled} />);

const radios = (html: string) => [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]);

describe("BetSelector", () => {
  it("AC1: lists the five bets as radios in order", () => {
    const values = radios(render(100)).map((tag) => tag.match(/value="(\d+)"/)![1]);
    expect(values).toEqual(["10", "25", "50", "100", "250"]);
  });

  it("AC1: only the selected bet is checked (100 by default, 250 once picked)", () => {
    const checked = (html: string) =>
      radios(html)
        .filter((tag) => tag.includes('checked=""'))
        .map((tag) => tag.match(/value="(\d+)"/)![1]);
    expect(checked(render(100))).toEqual(["100"]);
    expect(checked(render(250))).toEqual(["250"]);
  });

  it("is a labelled fieldset, disabled while spinning", () => {
    expect(render(100)).toMatch(/<fieldset class="bet"[^>]*><legend>Bet<\/legend>/);
    expect(render(100)).not.toContain("disabled");
    expect(render(100, true)).toContain("disabled");
  });
});
