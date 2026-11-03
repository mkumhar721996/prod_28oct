import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NoGamesFound } from "./NoGamesFound";

const render = (search: string, category: string | null) =>
  renderToStaticMarkup(<NoGamesFound filters={{ search, category }} onClear={() => {}} />);

type AnyEl = ReactElement<{ children?: unknown; onClick?: () => void }>;

function findButton(node: unknown): AnyEl | null {
  if (!node || typeof node !== "object") return null;
  const el = node as AnyEl;
  if (el.type === "button") return el;
  const kids = el.props?.children;
  for (const k of Array.isArray(kids) ? kids : [kids]) {
    const found = findButton(k);
    if (found) return found;
  }
  return null;
}

describe("NoGamesFound", () => {
  it("shows the message and a primary Clear filters button (AC6, AC8)", () => {
    const html = render("zzz", null);
    expect(html).toContain("<h2>No games found</h2>");
    expect(html).toContain('class="btn btn-primary"');
    expect(html).toContain(">Clear filters<");
  });

  it("names the search, the category, or both", () => {
    expect(render("xyz", null)).toContain("the name “xyz”");
    expect(render("", "Slots")).toContain("the Slots category");
    expect(render("xyz", "Slots")).toContain("the name “xyz” in the Slots category");
  });

  it("escapes search text", () => {
    expect(render("<b>", null)).not.toContain("<b>");
  });

  it("calls onClear when Clear filters is pressed (AC9-11)", () => {
    const onClear = vi.fn();
    findButton(NoGamesFound({ filters: { search: "a", category: "Dice" }, onClear }))?.props.onClick?.();
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
