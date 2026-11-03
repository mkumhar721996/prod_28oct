import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CartProvider } from "@/components/cart/CartProvider";

const getSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import MenuPage from "./page";

async function render() {
  return renderToStaticMarkup(<CartProvider>{await MenuPage()}</CartProvider>);
}

describe("Menu page", () => {
  it("shows the title, Cart button and placeholder items for a guest", async () => {
    getSession.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain(">Menu</h1>");
    expect(html).toContain('aria-label="Open cart"');
    expect(html).toContain("Margherita Pizza");
    expect(html).toContain("₹299");
    expect(html).toContain("Add to cart");
  });

  it("still renders when the session lookup throws", async () => {
    getSession.mockRejectedValue(new Error("down"));
    expect(await render()).toContain('aria-label="Open cart"');
  });

  it("never redirects guests", () => {
    expect(readFileSync(new URL("./page.tsx", import.meta.url), "utf8")).not.toContain("redirect(");
  });
});
