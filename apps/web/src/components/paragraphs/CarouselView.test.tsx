import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarouselView } from "./CarouselView";

describe("CarouselView", () => {
  it("renders only the first of the given slides, with controls", () => {
    const html = renderToStaticMarkup(
      <CarouselView className="x" slides={[<p key="1">One</p>, <p key="2">Two</p>]} />,
    );
    expect(html).toContain("One");
    expect(html).not.toContain("Two");
    expect(html).toContain("Next");
  });

  it("renders nothing for no slides", () => {
    expect(renderToStaticMarkup(<CarouselView className="x" slides={[]} />)).toBe("");
  });
});
