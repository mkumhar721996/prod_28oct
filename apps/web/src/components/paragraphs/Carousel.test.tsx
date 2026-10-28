import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ParagraphBlocks } from "./ParagraphBlocks";
import { defaultRegistry } from "./registry.default";
import type { ParagraphBlock } from "./registry";

// The slide paragraph type is not known yet; stand in a text-rendering one.
beforeAll(() => {
  const lookup = defaultRegistry.lookup;
  vi.spyOn(defaultRegistry, "lookup").mockImplementation((type) =>
    type === "carousel_slide"
      ? ({ block }: { block: ParagraphBlock }) => <p>{String(block.text)}</p>
      : lookup(type),
  );
});

const slide = (text: string) => ({ type: "carousel_slide", text });
const three = [slide("Slide A"), slide("Slide B"), slide("Slide C")];
const render = (slides: unknown[], type = "carousel") =>
  renderToStaticMarkup(<ParagraphBlocks blocks={[{ type, slides }]} />);

describe("Carousel", () => {
  it("shows the first slide on load (AC1, AC4)", () => {
    const html = render(three);
    expect(html).toContain("Slide A");
    expect(html).not.toContain("Slide B");
    expect(html).not.toContain("Slide C");
    expect(html).toContain("paragraph--type--carousel");
  });

  it("shows a single slide without controls (AC7, AC8)", () => {
    const html = render([slide("Only slide")]);
    expect(html).toContain("Only slide");
    expect(html).not.toMatch(/Previous|Next/);
  });

  it("renders nothing with no slides (AC9)", () => {
    expect(render([])).toBe("");
  });

  const carouselTypes = defaultRegistry.types().filter((t) => t.includes("carousel"));
  it("registers at least one carousel type", () => expect(carouselTypes.length).toBeGreaterThan(0));
  it.each(carouselTypes)("%s renders slides with controls (AC12)", (type) => {
    const html = render(three, type);
    expect(html).toContain("Next");
    expect(html).toContain("Previous");
  });
});
