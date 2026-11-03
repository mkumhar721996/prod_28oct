import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { filterMenu, menuCategories } from "@/lib/menu";
import { MENU_ITEMS, type MenuItem } from "@/lib/menuItems";
import { CartProvider } from "../cart/CartProvider";
import { MenuGrid } from "./MenuGrid";

describe("MenuGrid", () => {
  const html = renderToStaticMarkup(
    <CartProvider>
      <MenuGrid />
    </CartProvider>,
  );

  it("shows every item with name, INR price and image", () => {
    for (const item of MENU_ITEMS) {
      expect(html).toContain(item.name);
      expect(html).toContain(`src="${item.image}"`);
    }
    expect(html).toContain("₹299");
    expect(html).toContain("₹60");
    expect(html).toContain("₹149");
  });

  it("puts an Add to cart control on each card", () => {
    expect(html.match(/Add to cart/g)).toHaveLength(MENU_ITEMS.length);
    expect(html.match(/data-testid="menu-item"/g)).toHaveLength(MENU_ITEMS.length);
  });

  it("shows a chip per category, none pressed, and every dish (AC4, AC9)", () => {
    for (const c of menuCategories(MENU_ITEMS)) {
      expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${c}<`));
    }
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain("Search the menu");
  });
});

describe("MenuGrid filters", () => {
  const render = (props: Parameters<typeof MenuGrid>[0]) =>
    renderToStaticMarkup(
      <CartProvider>
        <MenuGrid {...props} />
      </CartProvider>,
    );
  const names = (html: string) => MENU_ITEMS.filter((d) => html.includes(d.name));

  it("shows only dishes matching the search, in any case (AC2)", () => {
    const part = MENU_ITEMS[0].name.slice(1, 4).toUpperCase();
    const html = render({ initial: { query: part } });
    expect(names(html)).toEqual(filterMenu(MENU_ITEMS, part, null));
    expect(names(html)).not.toEqual([...MENU_ITEMS]);
  });

  it("shows only dishes of the pressed category (AC3)", () => {
    const html = render({ initial: { category: "Drinks" } });
    expect(names(html)).toEqual(MENU_ITEMS.filter((d) => d.category === "Drinks"));
    expect(html).toMatch(/aria-pressed="true"[^>]*>Drinks</);
  });

  it("applies search and category together (AC7)", () => {
    const items: MenuItem[] = [
      { id: "a", name: "Pesto Pasta", category: "Mains", unitPrice: 1, image: "/a.svg" },
      { id: "b", name: "Beef Burger", category: "Mains", unitPrice: 1, image: "/b.svg" },
      { id: "c", name: "Lemonade", category: "Drinks", unitPrice: 1, image: "/c.svg" },
    ];
    const html = render({ items, initial: { query: "pesto", category: "Mains" } });
    expect(html).toContain("Pesto Pasta");
    expect(html).not.toContain("Beef Burger");
    expect(html).not.toContain("Lemonade");
  });

  it("shows No items match in place of the grid for a search with no match (AC8)", () => {
    const html = render({ initial: { query: "zzzz-no-dish" } });
    expect(html).toContain("No items match");
    expect(html).toContain("Clear filters");
    expect(html).not.toContain('data-testid="menu-item"');
  });

  it("shows No items match for a category with no dish (AC8)", () => {
    const items = MENU_ITEMS.filter((d) => d.category !== "Sides");
    const html = render({ items, initial: { category: "Sides" } });
    expect(html).toContain("No items match");
    expect(html).not.toContain('data-testid="menu-item"');
  });
});
