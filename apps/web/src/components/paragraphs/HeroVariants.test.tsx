import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParagraphBlocks } from "./ParagraphBlocks";
import { defaultRegistry } from "./registry.default";
import type { ParagraphBlock } from "./registry";

const cta = { uri: "/plan", title: "Start planning" };
const split: ParagraphBlock = {
  type: "hero_split",
  id: "1",
  field_title: "Plan your next trip with confidence",
  field_text: "Compare routes, book in minutes",
  field_cta: cta,
  field_hero_image: { url: "/img/hero-split.jpg", alt: "Travellers checking a map at a station" },
};
const overlay: ParagraphBlock = {
  type: "hero_overlay",
  id: "2",
  field_title: "Every journey starts somewhere",
  field_text: "Find guides written by locals",
  field_cta: cta,
  field_hero_background: { url: "/img/hero-bg.jpg", alt: "Mountain road at sunrise" },
  field_hero_image: { url: "/img/wrong.jpg", alt: "wrong" },
};
const feature: ParagraphBlock = {
  type: "hero_feature",
  id: "3",
  field_title: "Travel light, pack smart",
  field_text: "Download our checklist",
  field_cta: cta,
  field_hero_image: { url: "/img/hero-feature.jpg", alt: "Open suitcase" },
};

const render = (...blocks: ParagraphBlock[]) =>
  renderToStaticMarkup(<ParagraphBlocks blocks={blocks} />);

describe("AC1: every hero variant renders in place of its block", () => {
  it("renders three sections in order and registers the types", () => {
    const html = render(split, overlay, feature);
    expect((html.match(/<section/g) ?? []).length).toBe(3);
    expect(html.indexOf("hero--split")).toBeLessThan(html.indexOf("hero--overlay"));
    expect(html.indexOf("hero--overlay")).toBeLessThan(html.indexOf("hero--tint"));
    expect(defaultRegistry.types()).toEqual(
      expect.arrayContaining(["hero_split", "hero_overlay", "hero_feature"]),
    );
  });
});

describe("AC2: same text and images as production", () => {
  it.each([split, overlay, feature])("shows text, cta and image for $type", (block) => {
    const html = render(block);
    expect(html).toContain(block.field_title as string);
    expect(html).toContain(block.field_text as string);
    expect(html).toContain('href="/plan"');
    expect(html).toContain("Start planning");
  });

  it("shows the split image with alt text", () => {
    const html = render(split);
    expect(html).toContain('src="/img/hero-split.jpg"');
    expect(html).toContain('alt="Travellers checking a map at a station"');
  });

  it("overlay reads its own background field", () => {
    const html = render(overlay);
    expect(html).toContain('src="/img/hero-bg.jpg"');
    expect(html).not.toContain("wrong.jpg");
  });

  it("omits the button without a cta and escapes text", () => {
    expect(render({ type: "hero_split", field_title: "T" })).not.toContain("btn-primary");
    expect(render({ type: "hero_split", field_title: "<b>x</b>" })).not.toContain("<b>x</b>");
  });
});

describe("AC3: same layout and styling", () => {
  it("uses the variant classes and DOM order", () => {
    const splitHtml = render(split);
    const overlayHtml = render(overlay);
    expect(splitHtml).toContain(
      'class="paragraph paragraph--type--hero-split hero hero--split"',
    );
    expect(render(feature)).toContain("hero--tint");
    expect(splitHtml.indexOf("hero-copy")).toBeLessThan(splitHtml.indexOf("hero-img"));
    expect(overlayHtml.indexOf("hero-img")).toBeLessThan(overlayHtml.indexOf("hero-copy"));
  });

  it("styles the heroes with tokens only", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.hero--tint\s*\{[^}]*var\(--color-primary-bg\)/);
    const heroCss = css.slice(css.indexOf(".hero {"));
    expect(heroCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
  });
});
