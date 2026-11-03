import type { MenuCategory, MenuItem } from "./menuItems";

/** Categories present in the items, each once, in first-seen order. */
export function menuCategories(items: readonly MenuItem[]): MenuCategory[] {
  return [...new Set(items.map((d) => d.category))];
}

/** Name contains the (trimmed, case-insensitive) query AND the category matches when one is set. */
export function filterMenu(
  items: readonly MenuItem[],
  query: string,
  category: MenuCategory | null,
): MenuItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (d) => d.name.toLowerCase().includes(needle) && (category === null || d.category === category),
  );
}
