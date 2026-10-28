import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ParagraphBlocks } from "../ParagraphBlocks";
import type { ParagraphBlock } from "../registry";

const render = (block: ParagraphBlock) => renderToStaticMarkup(<ParagraphBlocks blocks={[block]} />);

it("keeps benefits in the given order without deduplicating", () => {
  const html = render({
    type: "benefits",
    items: [{ title: "Zeta", description: "first" }, { title: "Alpha" }, { title: "Zeta" }],
  });
  expect(html.indexOf("Zeta")).toBeLessThan(html.indexOf("Alpha"));
  expect(html.match(/Zeta/g)).toHaveLength(2);
  expect(html).toContain("first");
  expect(html).toContain("paragraph--type--benefits");
});

it("renders without items", () => {
  expect(render({ type: "benefits" })).toContain("paragraph--type--benefits");
});

it("styles with tokens only", () => {
  const html = render({ type: "benefits", items: [{ title: "a" }] });
  expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  expect(html).toContain("var(--color-");
});
