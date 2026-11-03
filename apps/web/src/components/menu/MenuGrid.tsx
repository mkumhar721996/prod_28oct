"use client";

import { formatMoney } from "@/lib/cart";
import { MENU_ITEMS } from "@/lib/menuItems";
import { AddToCartControl } from "../cart/AddToCartControl";
import { useCart } from "../cart/CartProvider";

export function MenuGrid() {
  const { cart, add, increase, decrease } = useCart();
  return (
    <div className="grid">
      {MENU_ITEMS.map((item) => (
        <div className="card stack stack-2" key={item.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="menu-photo" src={item.image} alt="" />
          <h2 className="menu-name">{item.name}</h2>
          <p>{formatMoney(item.unitPrice)}</p>
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
  );
}
