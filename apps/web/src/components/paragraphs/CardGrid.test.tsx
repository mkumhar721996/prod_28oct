import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParagraphBlocks } from "./ParagraphBlocks";

const render = (block: Record<string, unknown>) =>
  renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "card_grid", ...block }]} />);

describe("CardGrid paragraph", () => {
  it("shows the cards in the given order (AC2)", () => {
    const cards = ["Alpha", "Beta", "Gamma", "Delta"].map((title) => ({ title }));
    const html = render({ cards });
    const titles = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(titles).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(html).toContain("paragraph paragraph--type--card-grid");
  });

  it("renders no cards when empty or missing", () => {
    expect(render({ cards: [] })).not.toContain("<article");
    expect(render({})).not.toContain("<article");
  });
});
