import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ParagraphBlocks } from "../ParagraphBlocks";
import type { ParagraphBlock } from "../registry";

const render = (block: ParagraphBlock) => renderToStaticMarkup(<ParagraphBlocks blocks={[block]} />);

it("shows the quote text with Drupal classes", () => {
  const html = render({ type: "quote", text: "Make it simple" });
  expect(html).toContain("Make it simple");
  expect(html).toContain("paragraph--type--quote");
});

it("renders the source only when present", () => {
  expect(render({ type: "quote", text: "x" })).not.toContain("<cite");
  expect(render({ type: "quote", text: "x", source: "Jane" })).toContain("Jane");
});

it("styles with tokens only", () => {
  const html = render({ type: "quote", text: "x" });
  expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  expect(html).toContain("var(--color-");
});
