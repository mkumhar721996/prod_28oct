import { describe, expect, it } from "vitest";
import { MENU_CATEGORIES, SEEDED_MENU, filterMenu, formatPrice } from "./menu";

const norm = (s: string) => s.replace(/ /g, " ");

describe("formatPrice", () => {
  it("formats paise as INR with Indian grouping", () => {
    expect(norm(formatPrice(125000))).toBe("₹1,250.00");
    expect(norm(formatPrice(24950))).toBe("₹249.50");
    expect(norm(formatPrice(5000000))).toBe("₹50,000.00");
  });
});

describe("seeded menu", () => {
  it("has six dishes and categories derived in first-seen order", () => {
    expect(SEEDED_MENU).toHaveLength(6);
    expect(MENU_CATEGORIES).toEqual([...new Set(SEEDED_MENU.map((d) => d.category))]);
    expect(MENU_CATEGORIES).toEqual(["Mains", "Sides", "Drinks"]);
  });
});

describe("filterMenu", () => {
  it("matches part of a name in any letter case", () => {
    const part = SEEDED_MENU[0].name.slice(1, 4).toUpperCase();
    const out = filterMenu(SEEDED_MENU, part, null);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.name.toLowerCase().includes(part.toLowerCase()))).toBe(true);
    expect(filterMenu(SEEDED_MENU, part.toLowerCase(), null)).toEqual(out);
  });

  it("filters by category", () => {
    const out = filterMenu(SEEDED_MENU, "", "Drinks");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.category === "Drinks")).toBe(true);
  });

  it("ANDs search and category", () => {
    const out = filterMenu(SEEDED_MENU, "e", "Mains");
    expect(out).toEqual(
      SEEDED_MENU.filter((d) => d.category === "Mains" && d.name.toLowerCase().includes("e")),
    );
    expect(out.length).toBeGreaterThan(0);
  });

  it("returns nothing when nothing matches and trims the query", () => {
    expect(filterMenu(SEEDED_MENU, "zzzz-no-dish", null)).toEqual([]);
    expect(filterMenu(SEEDED_MENU, "  ", null)).toEqual([...SEEDED_MENU]);
  });
});
