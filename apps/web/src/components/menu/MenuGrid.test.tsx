import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MENU_ITEMS } from "@/lib/menuItems";
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
  });
});
