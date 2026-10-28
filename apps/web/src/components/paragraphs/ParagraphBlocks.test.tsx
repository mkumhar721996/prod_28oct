import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FixtureTwo, FixtureType } from "./__fixtures__/FixtureType";
import { ParagraphBlocks } from "./ParagraphBlocks";
import { createRegistry } from "./registry";

const registry = createRegistry({
  FixtureType: { default: FixtureType },
  FixtureTwo: { default: FixtureTwo },
});
const render = (blocks: { type: string; id?: string }[]) =>
  renderToStaticMarkup(<ParagraphBlocks blocks={blocks} registry={registry} />);

describe("ParagraphBlocks", () => {
  it("keeps Drupal class names on the root (AC2)", () => {
    expect(render([{ type: "fixture_type" }])).toContain(
      'class="paragraph paragraph--type--fixture-type',
    );
  });

  it("renders the component in place of the block (AC4)", () => {
    const html = render([{ type: "fixture_type", id: "1" }]);
    expect(html).toContain('data-testid="fixture-type"');
    expect(html).not.toContain('fixture_type"}');
  });

  it("renders a new convention-following type with no other change (AC3)", () => {
    expect(render([{ type: "fixture_two" }])).toContain('data-testid="fixture-two"');
  });

  it("renders nothing for an unmapped type (AC5)", () => {
    expect(render([{ type: "no_such_type" }])).toBe("");
    expect(render([{ type: "no_such_type" }, { type: "fixture_type" }])).toBe(
      render([{ type: "fixture_type" }]),
    );
  });

  it("renders with the production registry, empty for now", () => {
    expect(renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "hero_banner" }]} />)).toBe("");
  });
});
