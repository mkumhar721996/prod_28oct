import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParagraphBlocks } from "./ParagraphBlocks";
import type { ParagraphBlock } from "./registry";

const render = (block: ParagraphBlock) => renderToStaticMarkup(<ParagraphBlocks blocks={[block]} />);
const withHtml = (html: string): ParagraphBlock => ({
  type: "rich_text",
  id: "1",
  text: { value: html, format: "full_html", processed: html },
});
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const richTextRules = (css.match(/\.paragraph--type--rich-text[^{]*\{[^}]*\}/g) ?? []).join("\n");

describe("RichText paragraph", () => {
  it("AC1: renders processed HTML unchanged inside the Drupal wrapper", () => {
    const html = "<p>Hello <strong>world</strong></p><ul><li>One</li></ul>";
    const out = render(withHtml(html));
    expect(out).toContain('class="paragraph paragraph--type--rich-text');
    expect(out).toContain(html);
  });

  it("renders the wrapper without throwing when the field is missing", () => {
    expect(render({ type: "rich_text" })).toContain("paragraph--type--rich-text");
  });

  it("AC2: wrapper carries rich-text and the stylesheet uses tokens only", () => {
    expect(render(withHtml("<p>x</p>"))).toContain('class="rich-text"');
    expect(richTextRules).toContain("var(--color-fg)");
    expect(richTextRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|\d+px/);
  });

  it("AC3: link markup passes through and is styled", () => {
    const link = '<a href="/about" target="_blank" rel="noopener">About</a>';
    expect(render(withHtml(`<p>${link}</p>`))).toContain(link);
    expect(richTextRules).toMatch(/\.paragraph--type--rich-text \.rich-text a\s*\{[^}]*var\(--color-primary\)/);
    expect(richTextRules).toContain("a:focus-visible");
  });

  it("AC4: hrefs are not rewritten", () => {
    for (const href of ["/about", "https://example.com/x?y=1#z"]) {
      const out = render(withHtml(`<p><a href="${href.replace(/&/g, "&amp;")}">l</a></p>`));
      expect(out).toContain(`<a href="${href}">l</a>`);
    }
  });
});
