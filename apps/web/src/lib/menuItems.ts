export type MenuItem = { id: string; name: string; unitPrice: number; image: string };

/** Placeholder catalogue (no catalogue API yet): product can replace it without touching cart code. */
export const MENU_ITEMS: readonly MenuItem[] = [
  { id: "margherita", name: "Margherita Pizza", unitPrice: 299, image: "/menu/margherita.svg" },
  { id: "cola", name: "Cola", unitPrice: 60, image: "/menu/cola.svg" },
  { id: "garlic-bread", name: "Garlic Bread", unitPrice: 149, image: "/menu/garlic-bread.svg" },
];
