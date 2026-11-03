export type MenuCategory = "Mains" | "Sides" | "Drinks";
export type MenuItem = {
  id: string;
  name: string;
  category: MenuCategory;
  pricePaise: number;
  imageSrc: string;
};

/** Phase 1 starter menu: static demo data; a backend Menu API replaces it later. */
export const SEEDED_MENU: readonly MenuItem[] = [
  { id: "butter-chicken", name: "Butter Chicken", category: "Mains", pricePaise: 34900, imageSrc: "/menu/butter-chicken.svg" },
  { id: "paneer-tikka", name: "Paneer Tikka", category: "Mains", pricePaise: 29900, imageSrc: "/menu/paneer-tikka.svg" },
  { id: "garlic-naan", name: "Garlic Naan", category: "Sides", pricePaise: 6900, imageSrc: "/menu/garlic-naan.svg" },
  { id: "jeera-rice", name: "Jeera Rice", category: "Sides", pricePaise: 12900, imageSrc: "/menu/jeera-rice.svg" },
  { id: "masala-chai", name: "Masala Chai", category: "Drinks", pricePaise: 5900, imageSrc: "/menu/masala-chai.svg" },
  { id: "mango-lassi", name: "Mango Lassi", category: "Drinks", pricePaise: 9900, imageSrc: "/menu/mango-lassi.svg" },
];

export const MENU_CATEGORIES: readonly MenuCategory[] = [
  ...new Set(SEEDED_MENU.map((d) => d.category)),
];

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

const PRICE_FORMAT = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function formatPrice(pricePaise: number): string {
  return PRICE_FORMAT.format(pricePaise / 100);
}
