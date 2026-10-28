import { describe, expect, it } from "vitest";
import { classNamesForType, componentNameForType, createRegistry } from "./registry";

const Hero = () => null;
const Grid = () => null;

describe("registry", () => {
  it("finds exactly one component for a type", () => {
    const registry = createRegistry({ HeroBanner: { default: Hero }, CardGrid: { default: Grid } });
    expect(registry.lookup("hero_banner")).toBe(Hero);
    expect(registry.types().filter((t) => t === "hero_banner")).toHaveLength(1);
    expect(registry.lookup("unknown_type")).toBeUndefined();
  });

  it("throws when two modules resolve to the same type", () => {
    expect(() =>
      createRegistry({ HeroBanner: { default: Hero }, "hero-banner": { default: Grid } }),
    ).toThrow(/duplicate/i);
  });

  it("derives component names", () => {
    expect(componentNameForType("card_grid")).toBe("CardGrid");
  });

  it("finds a new PascalCase module by its snake_case type", () => {
    const registry = createRegistry({ NewThing: { default: Hero } });
    expect(registry.lookup("new_thing")).toBe(Hero);
  });

  it.each([
    ["hero_banner", "paragraph paragraph--type--hero-banner"],
    ["card_grid", "paragraph paragraph--type--card-grid"],
    ["text", "paragraph paragraph--type--text"],
  ])("derives Drupal class names for %s", (type, expected) => {
    expect(classNamesForType(type)).toBe(expected);
  });
});
