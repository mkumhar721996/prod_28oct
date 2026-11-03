import { describe, expect, it } from "vitest";
import { filterMenu, menuCategories } from "./menu";
import { MENU_ITEMS, type MenuItem } from "./menuItems";

const dish = (id: string, name: string, category: MenuItem["category"]): MenuItem => ({
  id,
  name,
  category,
  unitPrice: 100,
  image: `/menu/${id}.svg`,
});
const TWO_PER_CATEGORY: readonly MenuItem[] = [
  dish("a", "Pesto Pasta", "Mains"),
  dish("b", "Beef Burger", "Mains"),
  dish("c", "Hot Wings", "Mains"),
  dish("d", "Side Salad", "Sides"),
  dish("e", "Lemonade", "Drinks"),
];

describe("menuCategories", () => {
  it("lists each seeded category once, in first-seen order", () => {
    expect(menuCategories(MENU_ITEMS)).toEqual(["Mains", "Drinks", "Sides"]);
    expect(menuCategories(TWO_PER_CATEGORY)).toEqual(["Mains", "Sides", "Drinks"]);
  });
});

describe("filterMenu", () => {
  it("matches part of a name in any letter case (AC2)", () => {
    const part = MENU_ITEMS[0].name.slice(1, 4).toUpperCase();
    const out = filterMenu(MENU_ITEMS, part, null);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.name.toLowerCase().includes(part.toLowerCase()))).toBe(true);
    expect(filterMenu(MENU_ITEMS, part.toLowerCase(), null)).toEqual(out);
  });

  it("filters by category (AC3)", () => {
    const out = filterMenu(MENU_ITEMS, "", "Drinks");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.category === "Drinks")).toBe(true);
  });

  it("ANDs search and category (AC7)", () => {
    const out = filterMenu(TWO_PER_CATEGORY, "e", "Mains");
    expect(out).toEqual(
      TWO_PER_CATEGORY.filter((d) => d.category === "Mains" && d.name.toLowerCase().includes("e")),
    );
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(filterMenu(TWO_PER_CATEGORY, "e", null).length);
  });

  it("returns nothing when nothing matches (AC8)", () => {
    expect(filterMenu(MENU_ITEMS, "zzzz-no-dish", null)).toEqual([]);
  });

  it("returns every dish with no search and no category (AC9)", () => {
    expect(filterMenu(MENU_ITEMS, "", null)).toEqual(MENU_ITEMS);
    expect(filterMenu(MENU_ITEMS, "   ", null)).toEqual(MENU_ITEMS);
  });
});
