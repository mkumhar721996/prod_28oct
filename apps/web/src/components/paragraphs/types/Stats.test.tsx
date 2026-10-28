import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ParagraphBlocks } from "../ParagraphBlocks";
import type { ParagraphBlock } from "../registry";

const render = (block: ParagraphBlock) => renderToStaticMarkup(<ParagraphBlocks blocks={[block]} />);

it("pairs each figure with its label in source order", () => {
  const html = render({
    type: "stats",
    items: [
      { figure: "98%", label: "Satisfied" },
      { figure: "10k", label: "Users" },
    ],
  });
  expect(html).toMatch(/98%[\s\S]*Satisfied[\s\S]*10k[\s\S]*Users/);
  expect(html).toContain("paragraph--type--stats");
});

it("renders without items", () => {
  expect(render({ type: "stats" })).toContain("paragraph--type--stats");
});

it("styles with tokens only", () => {
  const html = render({ type: "stats", items: [{ figure: "1", label: "a" }] });
  expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  expect(html).toContain("var(--color-");
});
