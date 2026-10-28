import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParagraphBlocks } from "./ParagraphBlocks";
import { defaultRegistry } from "./registry.default";

const render = (block: Record<string, unknown>) =>
  renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "card", id: "1", ...block }]} />);

describe("Card paragraph", () => {
  it("shows the card content (AC1)", () => {
    const html = render({
      title: "Plan your first project",
      text: "Set up a project in minutes.",
      image: { url: "/a.jpg", alt: "Plan" },
      link: { url: "/plan", title: "Read more" },
    });
    expect(html).toContain("paragraph paragraph--type--card");
    expect(html).toContain("<h2>Plan your first project</h2>");
    expect(html).toContain("Set up a project in minutes.");
    expect(html).toContain('src="/a.jpg"');
    expect(html).toContain('href="/plan"');
  });

  it("renders no img without an image", () => {
    const html = render({ title: "No image" });
    expect(html).not.toContain("<img");
    expect(html).toContain("<h2>No image</h2>");
  });

  it("is registered with the card grid", () => {
    expect(defaultRegistry.types()).toEqual(expect.arrayContaining(["card", "card_grid"]));
  });
});
