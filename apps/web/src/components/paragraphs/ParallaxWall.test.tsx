import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParagraphBlocks } from "./ParagraphBlocks";
import { PARALLAX_LAYERS } from "./types/parallaxWall.config";

const wallBlock = {
  type: "parallax_wall",
  id: "1",
  field_text: "Wall headline",
  field_image: { url: "/files/wall.jpg", alt: "Wall alt" },
};
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const render = (block: object) => renderToStaticMarkup(<ParagraphBlocks blocks={[block as never]} />);

describe("ParallaxWall", () => {
  it("renders the wall's text and image with Drupal classes (AC1)", () => {
    const html = render(wallBlock);
    expect(html).toContain("Wall headline");
    expect(html).toContain('src="/files/wall.jpg"');
    expect(html).toContain('alt="Wall alt"');
    expect(html).toContain('class="paragraph paragraph--type--parallax-wall');
  });

  it("renders no img when the image is missing (AC1)", () => {
    const html = render({ type: "parallax_wall", field_text: "Only text" });
    expect(html).toContain("Only text");
    expect(html).not.toContain("<img");
  });

  it("applies the configured rate and direction per layer (AC2, AC3)", () => {
    const html = render(wallBlock);
    for (const layer of Object.values(PARALLAX_LAYERS)) {
      expect(html).toContain(`--parallax-speed:${layer.speed}`);
      expect(html).toContain(`--parallax-dir:${layer.direction}`);
    }
  });

  it("is driven by page scroll, not a nested scroller (AC2)", () => {
    const wallCss = css.slice(css.indexOf(".parallax-wall {"));
    expect(wallCss).toContain("animation-timeline: view()");
    expect(wallCss).not.toMatch(/overflow-y:\s*auto/);
    expect(render(wallBlock)).not.toContain("scroll-space");
  });

  it("disables the parallax transform under reduced motion (AC4)", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\.parallax-wall/s);
  });

  it("renders edited field values (AC5)", () => {
    const html = render({
      ...wallBlock,
      field_text: "Edited",
      field_image: { url: "/files/new.jpg", alt: "New" },
    });
    expect(html).toContain("Edited");
    expect(html).toContain('src="/files/new.jpg"');
    expect(html).not.toContain("Wall headline");
  });
});
