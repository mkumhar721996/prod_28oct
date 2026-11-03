"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import {
  MENU_CATEGORIES,
  SEEDED_MENU,
  filterMenu,
  type MenuCategory,
  type MenuItem,
} from "@/lib/menu";
import { MenuItemCard } from "./MenuItemCard";
import { NoItemsMatch } from "./NoItemsMatch";

export type MenuScreenProps = {
  items?: readonly MenuItem[];
  /** Starting filters, for rendering a given state without effects (tests). */
  initial?: { query?: string; category?: MenuCategory | null };
};

export function MenuScreen({ items = SEEDED_MENU, initial }: MenuScreenProps) {
  const [query, setQuery] = useState(initial?.query ?? "");
  const [category, setCategory] = useState<MenuCategory | null>(initial?.category ?? null);
  const { add } = useCart();
  const shown = filterMenu(items, query, category);

  return (
    <div className="stack stack-4">
      <h1 className="text-3xl font-semibold" data-testid="menu-title">
        Menu
      </h1>
      <div className="field">
        <label htmlFor="menu-search">Search the menu</label>
        <input
          id="menu-search"
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="chip-group" role="group" aria-label="Categories" data-testid="categories">
        {MENU_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={category === c}
            onClick={() => setCategory(category === c ? null : c)}
          >
            {c}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <NoItemsMatch
          onClear={() => {
            setQuery("");
            setCategory(null);
          }}
        />
      ) : (
        <ul className="menu-grid" data-testid="menu-items" aria-label="Menu items">
          {shown.map((item) => (
            <MenuItemCard key={item.id} item={item} onAdd={add} />
          ))}
        </ul>
      )}
    </div>
  );
}
