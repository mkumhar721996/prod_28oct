summary: |
  Add the customer-facing Menu screen at `/menu` in the Web App (Next.js, Tailwind + design-system tokens, vitest): a grid of seeded dishes (image, name, price), a case-insensitive name search, category chips (Mains, Sides, Drinks, derived from the seeded menu), combined search + category filtering, a "No items match" state, and an Add to cart button per dish that drives a cart count badge in the top bar. The starter menu is a static seeded module in the web app (no Records API call exists or is needed for this story); the cart is a small client-side store so later Cart/Checkout stories can build on it. Cart editing, the Cart screen and checkout are out of scope.
scope:
  - description: |
      Seeded starter menu and pure filter logic. Types and data:
      ```ts
      export type MenuCategory = "Mains" | "Sides" | "Drinks";
      export type MenuItem = { id: string; name: string; category: MenuCategory; pricePaise: number; imageSrc: string };
      export const SEEDED_MENU: readonly MenuItem[];            // 6 dishes, at least one per category
      export const MENU_CATEGORIES: readonly MenuCategory[];    // derived from SEEDED_MENU, first-seen order
      export function filterMenu(items: readonly MenuItem[], query: string, category: MenuCategory | null): MenuItem[];
      export function formatPrice(pricePaise: number): string;  // e.g. 125000 -> "₹1,250.00" (INR, en-IN, 2 decimals)
      ```
      `filterMenu` trims the query, matches `name.toLowerCase().includes(query.toLowerCase())`, ANDs with the category when set (AC 2, 3, 7).
    files:
      - apps/web/src/lib/menu.ts
      - apps/web/src/lib/menu.test.ts
    rationale: |
      Pure functions keep AC 2, 3, 4, 6, 7 testable without rendering, and mirror how `lib/orders.ts` holds the logic behind `OrdersScreen`.
  - description: |
      Placeholder dish images for the seed (one small SVG per dish, referenced by `imageSrc`). No colour literal beyond what the SVG needs; keep them neutral.
    files:
      - apps/web/public/menu/README.md
    rationale: |
      AC 1 needs an image per dish. Real photography is not in the story; implementer adds one SVG per seeded dish in this folder (named in `SEEDED_MENU.imageSrc`).
  - description: |
      Cart store. Pure reducer plus a client provider and hook:
      ```ts
      export type CartLine = { itemId: string; quantity: number };
      export type CartAction = { type: "add"; itemId: string };
      export function cartReducer(lines: CartLine[], action: CartAction): CartLine[];
      export function cartCount(lines: readonly CartLine[]): number;   // sum of quantities
      export function CartProvider({ children }: { children: React.ReactNode }): JSX.Element;
      export function useCart(): { lines: CartLine[]; count: number; add: (itemId: string) => void };
      ```
      Lines persist in `localStorage` under one key (read in an effect after mount to avoid hydration mismatch; ignore corrupt or unavailable storage and start empty). `add` on an existing line increments quantity; count is the sum of quantities.
    files:
      - apps/web/src/lib/cart.ts
      - apps/web/src/lib/cart.test.ts
      - apps/web/src/components/CartProvider.tsx
    rationale: |
      AC 5 needs a count shared between the Menu grid and the top bar (a sibling in the root layout), so state sits in a provider above both. Persistence honours the settled decision that a guest's cart survives the full-page navigation to sign-in and back at Checkout; it adds no editing features.
  - description: |
      Top bar cart control. Add the sketch's `cart-control` to the right of the nav / before Sign out: an `open-cart` ghost button-link ("Cart", `href="/cart"`, the sketch's `to-cart` exit; the Cart screen belongs to another story) plus a `cart-count` badge showing the count (`0` when empty, `aria-label` like "Cart, 1 item"). `TopBar` gets a `cartCount?: number` prop (default 0); `TopBarControls` reads `useCart().count`. Append `{ key: "menu", label: "Menu", href: "/menu" }` to the END of `MAIN_NAV` and add `MENU_HREF = "/menu"` and `CART_HREF = "/cart"` to `lib/shell.ts`. Wrap the layout body in `CartProvider`.
    files:
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBarControls.tsx
      - apps/web/src/components/TopBar.test.tsx
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/src/app/layout.tsx
    rationale: |
      Reuses `TopBar`/`TopBarControls` instead of a new header. UI guidelines say add cart links "only when a feature ships" and append nav entries at the end; this story ships the cart count, so both are now allowed.
  - description: |
      Menu screen UI. `MenuScreen` (client) holds `query` and `category` state and renders, in the sketch's order: `h1` "Menu" (`menu-title`), `search-menu` (`.field` + visible label "Search the menu" + `.input`, `type="search"`), `categories` (`.chip` buttons with `aria-pressed`, in a `role="group" aria-label="Categories"`; pressing the active chip again clears it), and `menu-items` (a `.menu-grid` of `.card`s, each with `item-image`, `item-name`, `item-price` and a `.btn .btn-primary` "Add to cart" whose accessible name includes the dish name). When `filterMenu` returns nothing, render the existing `.empty-state` with the text "No items match" (plus a "Clear filters" `.btn-secondary` that resets search and chip) in place of the grid (AC 8). Add to cart calls `useCart().add(item.id)`. Props follow `OrdersScreen`: `items?: readonly MenuItem[]` (default `SEEDED_MENU`) and `initial?: { query?: string; category?: MenuCategory | null }` for rendering states in tests. The sketch has no loading or error state for Menu: the seeded menu is static so none is built. Route: `app/menu/page.tsx` renders `MenuScreen` with no session redirect (guests order too).
    files:
      - apps/web/src/components/menu/MenuScreen.tsx
      - apps/web/src/components/menu/MenuScreen.test.tsx
      - apps/web/src/components/menu/MenuItemCard.tsx
      - apps/web/src/components/menu/NoItemsMatch.tsx
      - apps/web/src/app/menu/page.tsx
      - apps/web/src/app/menu/page.test.tsx
    rationale: |
      Mirrors `OrdersScreen`/`NoOrders` structure. Reuses the existing `.card`, `.chip`, `.input`, `.field`, `.btn-primary`, `.btn-secondary`, `.empty-state`, `.stack` classes from `globals.css` (design-system/prototype-utils.css origin); only the grid and image need new CSS.
  - description: |
      Styles, appended to `globals.css` (tokens already loaded via `@import "../../../../design-system/tokens.css"` at line 2). Add `.menu-grid` (`display:grid; gap: var(--space-3); grid-template-columns: 1fr`, three columns inside `@media (min-width: 768px)`, the same breakpoint literal the shell already uses; sketch `phone_columns: 1`, `columns: 3`), `.chip-group` (`display:flex; flex-wrap:wrap; gap: var(--space-2)`), `.menu-image` (`width:100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--radius-md); background: var(--color-bg-subtle)`), `.menu-price` (`color: var(--color-fg-muted)`), and `.cart-control` (flex row, `gap: var(--space-1)`) with the count styled via the existing `.badge` plus `.badge-neutral` (`--badge-neutral-background/-foreground`). Other tokens: `--space-2/3/4`, `--radius-md`, `--color-bg-subtle`, `--color-fg-muted`, `--color-primary`, `--color-focus`.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      Tokens only, no hex or raw px except the media-query breakpoint (as the shell already does) and the 4:3 ratio from the sketch (no token covers it; see open questions).
  - description: |
      Landing page entry for guests (reviewer decision). In `app/page.tsx` (Home, `/`), when `signedIn` is false render a `.btn .btn-primary` link "View Menu" with `href={MENU_HREF}` under the title; signed-in users do not get it (they have the Menu nav entry). It is the one primary action for the signed-out view. Authentication is not required for `/menu` or the cart; only Checkout (a separate story) will require it.
      ```tsx
      {!signedIn && (
        <div>
          <a className="btn btn-primary" href={MENU_HREF}>View Menu</a>
        </div>
      )}
      ```
    files:
      - apps/web/src/app/page.tsx
      - apps/web/src/app/home.test.tsx
    rationale: |
      Resolves the guest-discovery question: `visibleNav(false)` is empty, so without this a guest could only reach the Menu by typing the URL.
  - description: |
      Playwright journey covering the sketch's flows on `/menu`: load, search, chip, both together, empty state, add to cart and badge update.
    files:
      - apps/web/tests/e2e/menu.spec.ts
    rationale: |
      The stack names Playwright for web E2E; one spec confirms the pieces work in a real browser (provider in layout, count in the top bar).
tests:
  - |
    AC 1 (write first, fails until MenuScreen exists). In `MenuScreen.test.tsx`:
    ```ts
    const html = renderToStaticMarkup(<MenuScreen />);
    for (const d of SEEDED_MENU) {
      expect(html).toContain(d.name);
      expect(html).toContain(formatPrice(d.pricePaise));
      expect(html).toContain(d.imageSrc);
    }
    expect(html.match(/data-testid="menu-item"/g)).toHaveLength(SEEDED_MENU.length);
    ```
    Minimal code: `MenuScreen` + `MenuItemCard`, `menu-items` grid.
  - |
    Price format (AC 1, in `menu.test.ts`, write first). Intl may emit a non-breaking space after the symbol on some ICU versions, so normalise it:
    ```ts
    const norm = (s: string) => s.replace(/ /g, " ");
    expect(norm(formatPrice(125000))).toBe("₹1,250.00");
    expect(norm(formatPrice(24950))).toBe("₹249.50");
    expect(norm(formatPrice(5000000))).toBe("₹50,000.00");
    ```
  - |
    AC 2, in `menu.test.ts` and `MenuScreen.test.tsx`:
    ```ts
    const part = SEEDED_MENU[0].name.slice(1, 4).toUpperCase();
    const out = filterMenu(SEEDED_MENU, part, null);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.name.toLowerCase().includes(part.toLowerCase()))).toBe(true);
    expect(filterMenu(SEEDED_MENU, part.toLowerCase(), null)).toEqual(out);
    ```
    Screen test: render with `initial={{ query: part }}` and assert dishes not matching are absent from the markup.
  - |
    AC 3:
    ```ts
    const out = filterMenu(SEEDED_MENU, "", "Drinks");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.category === "Drinks")).toBe(true);
    ```
    Screen test: `initial={{ category: "Drinks" }}` shows only Drinks dishes and the Drinks chip has `aria-pressed="true"`. Client interaction (clicking a chip changes the grid) is covered in the Playwright spec.
  - |
    AC 4 and AC 6 (seeded data):
    ```ts
    expect(MENU_CATEGORIES).toEqual([...new Set(SEEDED_MENU.map((d) => d.category))]);
    const html = renderToStaticMarkup(<MenuScreen />);
    for (const c of MENU_CATEGORIES) expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${c}<`));
    ```
    Page test (`app/menu/page.test.tsx`): the `/menu` page renders every `SEEDED_MENU` dish name and no other `menu-item` cards.
  - |
    AC 5, in `cart.test.ts`, `TopBar.test.tsx` and the Playwright spec:
    ```ts
    expect(cartCount([])).toBe(0);
    const lines = cartReducer([], { type: "add", itemId: "d1" });
    expect(cartCount(lines)).toBe(1);
    expect(cartCount(cartReducer(lines, { type: "add", itemId: "d1" }))).toBe(2);
    ```
    `TopBar` renders `cartCount={1}` and the markup contains `data-testid="cart-count"` with text `1`. Playwright: open `/menu`, expect `getByTestId("cart-count")` to have text "0", click the first "Add to cart", expect text "1".
  - |
    AC 7:
    ```ts
    const out = filterMenu(SEEDED_MENU, "e", "Mains");
    expect(out.every((d) => d.category === "Mains" && d.name.toLowerCase().includes("e"))).toBe(true);
    expect(out).toEqual(SEEDED_MENU.filter((d) => d.category === "Mains" && d.name.toLowerCase().includes("e")));
    ```
    Screen test: `initial={{ query: "e", category: "Mains" }}` shows only those dishes.
  - |
    AC 8:
    ```ts
    expect(filterMenu(SEEDED_MENU, "zzzz-no-dish", null)).toEqual([]);
    const html = renderToStaticMarkup(<MenuScreen initial={{ query: "zzzz-no-dish" }} />);
    expect(html).toContain("No items match");
    expect(html).not.toContain('data-testid="menu-item"');
    ```
    Also a category-only no-match case using a test `items` prop that has no Sides dishes with `initial={{ category: "Sides" }}`.
  - |
    Guest entry (reviewer decision, in `home.test.tsx`, write first):
    ```ts
    getSession.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Home());
    expect(html).toMatch(/<a[^>]*href="\/menu"[^>]*>View Menu<\/a>/);
    ```
    and for a signed-in session `expect(html).not.toContain("View Menu")`. The `/menu` page test also asserts the page renders with `getSession` resolving `null` and never redirects. Playwright: from `/` signed out, click "View Menu" and land on `/menu` with the grid shown.
  - |
    Regression: `shell.test.ts` asserts `MAIN_NAV[MAIN_NAV.length - 1]` is `{ key: "menu", label: "Menu", href: "/menu" }` and the earlier entries keep their positions; `TopBar.test.tsx` still passes for existing cases. Corrupt `localStorage` content in `cart.test.ts` yields an empty cart.
assumptions_or_open_questions:
  - |
    Decided by the reviewer, seed source: a static menu module in the Web App for Phase 1 (no Records API menu endpoint exists; grepped apps/web/src and services/api/src). Replacing it with a backend Menu API is a future story tied to admin menu management.
  - |
    Decided by the reviewer, dishes and prices: keep six sample dishes across Mains, Sides and Drinks as demo seed data. Product can update `SEEDED_MENU` later; tests read from it, so cart and checkout code are unaffected.
  - |
    Decided by the reviewer, guest access: `/menu` is public and the guest landing page (Home) gets a "View Menu" link. Authentication is required only at Checkout (another story). The top bar cart control is shown signed-out as well as signed-in so guests see their count.
  - |
    Decided by the reviewer, cart persistence: `localStorage`; the cart survives sign-in and refresh, and is cleared only after a successful order or an explicit user action. Those two clear paths belong to the Checkout and Cart-editing stories, so this plan adds no clear action and nothing here empties the cart.
  - |
    The sketch's header has a "Menu / Orders" nav and an "Ordering" logo, while the existing shell uses the brand "Web App" and Home/Wallet/Orders/History/Appointments. The plan keeps the shell and only appends Menu and the cart control, per the UI guidelines.
  - |
    Images are placeholder SVGs, since no photography is provided.
  - |
    Decided by the reviewer, currency: Indian rupees (INR) with 2 decimals. `formatPrice` uses `new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` on `pricePaise / 100`, giving "₹1,250.00" with Indian digit grouping. Prices are stored as integer paise to avoid float drift.
  - |
    Decided by the reviewer, image ratio: a fixed 4:3 ratio (`aspect-ratio: 4 / 3`) on all menu images, treated as a UI requirement until a design token exists.
  - |
    Deferred project-wide questions on retention of orders, contact details and accounts do not affect this story (no orders, contact details or accounts are stored here); not addressed.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  None — the seed is a static TypeScript module shipped with the web app; no database schema, migration, stored data shape, env var or config changes. The cart's only storage is a new browser `localStorage` key, which is read defensively (missing or corrupt value means an empty cart), so nothing existing is affected. Rollback is a plain revert.

  ### Design and tokens
  Built from the approved sketch `PROD-28OCT-STORY-049-wireframe.yaml` (screen `menu`; no `state_of` entries, so only the default success state, plus the empty "No items match" state required by AC 8). Flows: `to-cart` (open-cart, to /cart) and `to-orders` (nav-orders, existing /orders nav entry) are exits, not built here beyond the links. Element ids from the sketch (`menu-item`, `item-image`, `item-name`, `item-price`, `add-to-cart`, `cart-count`, `open-cart`) are kept as `data-testid` on each repeated copy. Tokens are loaded by `apps/web/src/app/globals.css` line 2 (`@import "../../../../design-system/tokens.css"`, after `@import "tailwindcss"` on line 1); the app styles with `var(--token)` in plain CSS classes, which this plan continues. Existing components reused: `TopBar`, `TopBarControls`, and the `NoOrders`/`OrdersScreen` pattern for the empty state and screen structure.

  ```mermaid
  flowchart TD
    layout[app/layout.tsx]:::touched -->|wraps with CartProvider| cartprov[CartProvider]:::touched
    layout --> tbc[TopBarControls]:::touched
    tbc -->|reads count| cartprov
    tbc --> tb[TopBar]:::touched
    tb -->|cart control and Menu nav| shell[lib/shell.ts]:::touched
    menupage[app/menu/page.tsx]:::touched --> ms[MenuScreen]:::touched
    ms -->|filterMenu, SEEDED_MENU| menulib[lib/menu.ts]:::touched
    ms -->|add| cartprov
    cartprov --> cartlib[lib/cart.ts]:::touched
    css[globals.css]:::touched -.styles.-> ms
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN: the `/menu` screen (grid, search, chips, combined filtering, "No items match"), the seeded static menu, add-to-cart with the top-bar count, the nav/cart-control additions, and the guest "View Menu" link on Home (a reviewer-requested addition beyond the ACs). OUT: cart editing, the Cart and Checkout screens, any API or database work. Riskiest part is the shared cart state (provider in the root layout, `localStorage` read after mount to avoid a hydration mismatch) and the top-bar changes, which affect every page. The static seed, the localStorage persistence and the public (no session redirect) Menu route are deliberate reviewer-accepted decisions. This plan never clears the cart; clearing belongs to the Cart and Checkout stories.
