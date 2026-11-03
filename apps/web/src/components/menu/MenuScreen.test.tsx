import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MENU_CATEGORIES, SEEDED_MENU, formatPrice, type MenuItem } from "@/lib/menu";
import { MenuScreen } from "./MenuScreen";

const cards = (html: string) => html.match(/data-testid="menu-item"/g) ?? [];

describe("MenuScreen", () => {
  it("shows every seeded dish with image, name and price", () => {
    const html = renderToStaticMarkup(<MenuScreen />);
    for (const d of SEEDED_MENU) {
      expect(html).toContain(d.name);
      expect(html).toContain(formatPrice(d.pricePaise));
      expect(html).toContain(d.imageSrc);
      expect(html).toContain(`Add ${d.name} to cart`);
    }
    expect(cards(html)).toHaveLength(SEEDED_MENU.length);
    expect(html).toContain("Search the menu");
  });

  it("shows a chip per category, none pressed", () => {
    const html = renderToStaticMarkup(<MenuScreen />);
    for (const c of MENU_CATEGORIES) {
      expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${c}<`));
    }
  });

  it("filters by search text in any case", () => {
    const part = SEEDED_MENU[0].name.slice(1, 4).toUpperCase();
    const html = renderToStaticMarkup(<MenuScreen initial={{ query: part }} />);
    for (const d of SEEDED_MENU) {
      const matches = d.name.toLowerCase().includes(part.toLowerCase());
      expect(html.includes(d.name)).toBe(matches);
    }
  });

  it("filters by the selected category chip", () => {
    const html = renderToStaticMarkup(<MenuScreen initial={{ category: "Drinks" }} />);
    for (const d of SEEDED_MENU) expect(html.includes(d.name)).toBe(d.category === "Drinks");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Drinks</);
  });

  it("applies search and category together", () => {
    const html = renderToStaticMarkup(<MenuScreen initial={{ query: "e", category: "Mains" }} />);
    const expected = SEEDED_MENU.filter(
      (d) => d.category === "Mains" && d.name.toLowerCase().includes("e"),
    );
    expect(cards(html)).toHaveLength(expected.length);
    for (const d of SEEDED_MENU) expect(html.includes(d.name)).toBe(expected.includes(d));
  });

  it("shows No items match instead of the grid for a search with no match", () => {
    const html = renderToStaticMarkup(<MenuScreen initial={{ query: "zzzz-no-dish" }} />);
    expect(html).toContain("No items match");
    expect(html).not.toContain('data-testid="menu-item"');
    expect(html).toContain("Clear filters");
  });

  it("shows No items match for a category with no dish", () => {
    const items: MenuItem[] = SEEDED_MENU.filter((d) => d.category !== "Sides");
    const html = renderToStaticMarkup(<MenuScreen items={items} initial={{ category: "Sides" }} />);
    expect(html).toContain("No items match");
    expect(html).not.toContain('data-testid="menu-item"');
  });
});
