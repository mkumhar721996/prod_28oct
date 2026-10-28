import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ParagraphBlocks } from "../ParagraphBlocks";
import type { ParagraphBlock } from "../registry";

const render = (block: ParagraphBlock) => renderToStaticMarkup(<ParagraphBlocks blocks={[block]} />);

it("shows testimonial text and attribution", () => {
  const html = render({ type: "testimonial", id: "1", text: "Great work", author: "Ada", role: "CTO" });
  expect(html).toContain("Great work");
  expect(html).toContain("Ada");
  expect(html).toContain("CTO");
  expect(html).toContain('class="paragraph paragraph--type--testimonial');
});

it("omits the attribution when absent and tolerates missing fields", () => {
  const html = render({ type: "testimonial" });
  expect(html).not.toContain("<footer");
});

it("styles with tokens only", () => {
  const html = render({ type: "testimonial", text: "x", author: "Ada" });
  expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  expect(html).toContain("var(--color-");
});
