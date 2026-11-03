"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/cart";
import { filterMenu, menuCategories } from "@/lib/menu";
import { MENU_ITEMS, type MenuCategory, type MenuItem } from "@/lib/menuItems";
import { AddToCartControl } from "../cart/AddToCartControl";
import { useCart } from "../cart/CartProvider";

type MenuGridProps = {
  items?: readonly MenuItem[];
  /** Starting filters, for rendering a given state without effects (tests). */
  initial?: { query?: string; category?: MenuCategory | null };
};

export function MenuGrid({ items = MENU_ITEMS, initial }: MenuGridProps = {}) {
  const { cart, add, increase, decrease } = useCart();
  const [query, setQuery] = useState(initial?.query ?? "");
  const [category, setCategory] = useState<MenuCategory | null>(initial?.category ?? null);
  const shown = filterMenu(items, query, category);

  return (
    <div className="stack stack-4">
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
      <div className="chip-group" role="group" aria-label="Categories">
        {menuCategories(items).map((c) => (
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
        <div className="empty-state">
          <h2>No items match</h2>
          <p>Try a different search or category.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setQuery("");
              setCategory(null);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid">
          {shown.map((item) => (
            <div className="card stack stack-2" key={item.id} data-testid="menu-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="menu-photo" data-testid="item-image" src={item.image} alt="" />
              <h2 className="menu-name" data-testid="item-name">
                {item.name}
              </h2>
              <p data-testid="item-price">{formatMoney(item.unitPrice)}</p>
              <div>
                <AddToCartControl
                  item={item}
                  cart={cart}
                  onAdd={add}
                  onIncrease={increase}
                  onDecrease={decrease}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
