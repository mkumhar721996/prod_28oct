summary: |
  Add search and category filtering to the Menu screen that already exists at `/menu`. STORY-050 (merged) already ships the Menu page, the placeholder `MENU_ITEMS` catalogue (3 dishes), `MenuGrid` with image, name, price and Add to cart, the root-layout `CartProvider` (localStorage), and the `CartButton` whose badge shows the cart count (0 when empty, +1 per add). So this story only adds what is missing: a `category` on each seeded dish, a pure `filterMenu` and `menuCategories` in `lib/menu.ts`, a search field, category chips, combined filtering, and a "No items match" empty state in `MenuGrid`. Image ratio moves to the sketch's 4:3. The earlier draft proposed a new cart store, top-bar cart control, Menu nav entry, Home link and a second seed module. All of those duplicate or conflict with merged code (`components/cart/CartProvider.tsx`, `lib/cart.ts`, `MAIN_NAV` already holds a public Menu entry, `MENU_HREF` exists in `lib/shell.ts`), so they are dropped.
scope:
  - description: |
      Add `category` to the seeded catalogue and add pure filter helpers.

      ```ts
      // lib/menuItems.ts: MenuItem gains a category, every seeded dish gets one
      export type MenuCategory = "Mains" | "Sides" | "Drinks";
      export type MenuItem = { id: string; name: string; category: MenuCategory; unitPrice: number; image: string };
      // margherita -> Mains, garlic-bread -> Sides, cola -> Drinks

      // lib/menu.ts (new)
      export function menuCategories(items: readonly MenuItem[]): MenuCategory[]; // first-seen order, no duplicates
      export function filterMenu(items: readonly MenuItem[], query: string, category: MenuCategory | null): MenuItem[];
      ```
      `filterMenu` trims the query, matches `name.toLowerCase().includes(query.toLowerCase())`, and ANDs with the category when set (AC 2, 3, 7, 9). An empty query and null category return every item. The cart code is untouched: `AddToCartControl` takes `Omit<CartLine, "quantity">`, and `MenuGrid` passes the item through, so `MenuGrid` must strip `category` before calling it (or `CartLine` stays unchanged and `category` is simply not part of the passed object).
    files:
      - apps/web/src/lib/menuItems.ts
      - apps/web/src/lib/menu.ts
      - apps/web/src/lib/menu.test.ts
    rationale: |
      Pure functions make AC 2, 3, 4, 6, 7, 8 and 9 testable without rendering. They extend the existing seed rather than adding a second catalogue.
  - description: |
      Extend `MenuGrid` with search, chips and the no-match state, following the sketch's order: `search-menu`, then `categories`, then `menu-items`.

      ```tsx
      type MenuGridProps = {
        items?: readonly MenuItem[];                                        // default MENU_ITEMS
        initial?: { query?: string; category?: MenuCategory | null };       // for rendering states in tests
      };
      export function MenuGrid({ items = MENU_ITEMS, initial }: MenuGridProps = {}): JSX.Element;
      ```
      - State: `useState` for `query` and `category`. Visible items are `filterMenu(items, query, category)`.
      - Search: `.field` with a visible label "Search the menu" and an `.input` of `type="search"`.
      - Chips: a `role="group" aria-label="Categories"` container of `.chip` buttons, one per `menuCategories(items)`, each with `aria-pressed`. Pressing the active chip clears it (AC 9 is the cleared state).
      - Grid: the existing `.grid` of `.card`s (image, name, price, `AddToCartControl`) built from the filtered items. Add `data-testid` values from the sketch ids (`menu-item`, `item-name`, `item-price`, `item-image`) on each card.
      - No match (AC 8): when the filtered list is empty, render the existing `.empty-state` with the text "No items match" and a `.btn-secondary` "Clear filters" that resets both inputs, in place of the grid. Wording is sentence case and brief, per the UI guidelines.
      - Items missing from the grid are removed from the markup, not hidden.
      - Cart behaviour is unchanged: the `useCart().add` path, the `CartButton` badge in `MenuCart` (the sketch's `cart-control`, `open-cart`, `cart-count`) and the drawer all stay as built in STORY-050. AC 5, 10 and 11 are covered by it, and this story adds regression tests only.
      - The sketch has no loading or error state for Menu (the seed is static), so none is built.
    files:
      - apps/web/src/components/menu/MenuGrid.tsx
      - apps/web/src/components/menu/MenuGrid.test.tsx
    rationale: |
      `MenuGrid` is already the Menu's item grid and is rendered by `app/menu/page.tsx`, so extending it keeps the page, the provider and the existing tests intact. The `items`/`initial` props mirror how `OrdersScreen` is rendered in tests, so server-rendered markup can assert filter states.
  - description: |
      Styles, appended to `globals.css` using tokens only (tokens load via the `@import` of `design-system/tokens.css` near the top of the file). Add `.chip-group` (`display: flex; flex-wrap: wrap; gap: var(--space-2)`). Change `.menu-photo` from `aspect-ratio: 1` to `aspect-ratio: 4 / 3` to match the sketch's `aspect: '4:3'` (no token covers a ratio). The sketch asks for 3 columns on tablet and above and 1 on phone, while the existing `.grid` is `auto-fill` with a `--size-drawer` minimum. Keep `.grid` as it is (the Cart drawer work depends on it) and only revisit if the reviewer wants strictly 3 columns (see open questions). Reused as-is: `.field`, `.input`, `.chip` (including `aria-pressed`), `.card`, `.empty-state`, `.btn-secondary`, `.stack`.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      Only the chip row and the image ratio are new CSS. Other tokens used: `--space-2`, `--space-3`, `--color-bg-subtle`, `--radius-md`.
  - description: |
      Playwright journey on `/menu` covering the sketch's flows: load with all dishes and chips, search in mixed case, chip filter, search plus chip together, no-match message and Clear filters, and the cart badge going 0 to 1 to 2 after Add to cart. Follow the setup in `tests/e2e/home.spec.ts` and `top-bar.spec.ts`.
    files:
      - apps/web/tests/e2e/menu.spec.ts
    rationale: |
      Client interaction (typing, pressing chips) cannot be asserted with `renderToStaticMarkup`, so one browser spec confirms it. The e2e command is not part of the configured unit test command.
tests:
  - |
    AC 1, regression in `MenuGrid.test.tsx` (already passes, keep it): every `MENU_ITEMS` entry shows its name, `src="${item.image}"` and its formatted price. Add `expect(html.match(/data-testid="menu-item"/g)).toHaveLength(MENU_ITEMS.length)` (fails until the `data-testid` is added).
  - |
    AC 2, write first in `menu.test.ts`:
    ```ts
    const part = MENU_ITEMS[0].name.slice(1, 4).toUpperCase();
    const out = filterMenu(MENU_ITEMS, part, null);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.name.toLowerCase().includes(part.toLowerCase()))).toBe(true);
    expect(filterMenu(MENU_ITEMS, part.toLowerCase(), null)).toEqual(out);
    ```
    Screen test: `renderToStaticMarkup(<CartProvider><MenuGrid initial={{ query: part }} /></CartProvider>)` contains the matching dish and not the others.
  - |
    AC 3, in `menu.test.ts` and `MenuGrid.test.tsx`:
    ```ts
    const out = filterMenu(MENU_ITEMS, "", "Drinks");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.category === "Drinks")).toBe(true);
    ```
    Screen test with `initial={{ category: "Drinks" }}`: only Drinks dishes render and the Drinks chip has `aria-pressed="true"`.
  - |
    AC 4 and AC 6, seeded data:
    ```ts
    expect(menuCategories(MENU_ITEMS)).toEqual([...new Set(MENU_ITEMS.map((d) => d.category))]);
    const html = renderToStaticMarkup(<CartProvider><MenuGrid /></CartProvider>);
    for (const c of menuCategories(MENU_ITEMS)) expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${c}<`));
    ```
    Page test in `app/menu/page.test.tsx` (extend): the `/menu` page renders every `MENU_ITEMS` name and exactly `MENU_ITEMS.length` `menu-item` cards.
  - |
    AC 5, 10 and 11, regression, no new code: `cart.test.ts` already holds the add and count logic. Add to `cart.test.ts` if missing:
    ```ts
    expect(cartCount([])).toBe(0);
    const one = addItem([], { id: "cola", name: "Cola", unitPrice: 60, image: "/menu/cola.svg" });
    expect(cartCount(one)).toBe(1);
    expect(cartCount(addItem(one, { id: "garlic-bread", name: "Garlic Bread", unitPrice: 149, image: "/menu/garlic-bread.svg" }))).toBe(2);
    ```
    The Menu page test (extend) asserts the `CartButton` badge shows `0` on first render (`<span class="badge badge-neutral">0</span>`). Playwright: badge `0`, press Add to cart on a dish and expect `1`, add a second dish and expect `2`.
  - |
    AC 7, in `menu.test.ts` using an injected list with two dishes per category so the combination is meaningful:
    ```ts
    const out = filterMenu(items, "e", "Mains");
    expect(out).toEqual(items.filter((d) => d.category === "Mains" && d.name.toLowerCase().includes("e")));
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(filterMenu(items, "e", null).length);
    ```
    Screen test: `initial={{ query: "e", category: "Mains" }}` with the same `items` prop shows only those dishes.
  - |
    AC 8, write first:
    ```ts
    expect(filterMenu(MENU_ITEMS, "zzzz-no-dish", null)).toEqual([]);
    const html = renderToStaticMarkup(<CartProvider><MenuGrid initial={{ query: "zzzz-no-dish" }} /></CartProvider>);
    expect(html).toContain("No items match");
    expect(html).not.toContain('data-testid="menu-item"');
    ```
    Category-only no match: pass an `items` list with no Sides dishes and `initial={{ category: "Sides" }}`, and expect the same message.
  - |
    AC 9:
    ```ts
    expect(filterMenu(MENU_ITEMS, "", null)).toEqual(MENU_ITEMS);
    expect(filterMenu(MENU_ITEMS, "   ", null)).toEqual(MENU_ITEMS);
    ```
    Screen test: default render has no chip with `aria-pressed="true"` and every category's dishes are present.
  - |
    Regression: `shell.test.ts` and `TopBar.test.tsx` are unchanged and must still pass (the plan no longer touches them). `cartStorage.test.ts` and `AddToCartControl.test.tsx` still pass with the `category` field present on seeded items.
assumptions_or_open_questions:
  - |
    The earlier draft assumed no cart, Menu page or top-bar cart control existed. I read the worktree: they exist from STORY-050 (`components/cart/CartProvider.tsx`, `CartButton.tsx`, `MenuCart.tsx`, `lib/cart.ts`, `lib/cartStorage.ts`, `app/menu/page.tsx`, `MenuGrid.tsx`, `lib/menuItems.ts`). The plan therefore extends them. The earlier plan's new top-bar cart control, Menu nav entry (already in `MAIN_NAV`, public), Home "View Menu" link, `lib/cart.ts` rewrite and second seed module are dropped as duplicates or conflicts. If the reviewer still wants a Home "View Menu" link for guests, that is a separate small addition, as `visibleNav(false)` already shows the public Menu entry to guests.
  - |
    The sketch's `cart-control` (Cart button plus `cart-count` badge) is satisfied by the existing `CartButton` in the Menu page's title row, not the top bar. Moving it into the top bar is not planned.
  - |
    The seeded menu has 3 dishes, one per category (Mains, Sides, Drinks); the sketch shows `repeat: 6`. AC 7 (search plus chip) is only meaningful with more than one dish per category, so its tests use an injected `items` list. Open question for product: should the seed grow to 6 dishes? That needs 3 more SVGs in `apps/web/public/menu/` and updated tests that read from `MENU_ITEMS`.
  - |
    The sketch says 3 columns and 1 on phone, but the existing `.grid` is `auto-fill` (about 3 columns at shell width). I keep it unchanged because the layout is shared with the Cart drawer styles. Say if strict 3/1 columns is required.
  - |
    Interaction tests (typing in search, pressing chips) run in the Playwright spec, because the unit suite renders with `renderToStaticMarkup` and no DOM test library is used in the existing tests. State is covered through the `initial` prop.
  - |
    The deferred project-wide questions on retention of orders, contact details and accounts do not affect this story, since nothing is stored beyond the existing cart in localStorage. Not addressed. The guest-cart-through-sign-in decision is already honoured by the existing `CartProvider` and is not changed.
  - |
    The work item text contained no instructions outside the change itself; nothing was refused.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout
  None — the seed is a static TypeScript module and the change adds one field (`category`) to it. There is no schema, migration, env var or config change. The persisted cart in localStorage (`CART_STORAGE_KEY`, parsed by `parseCart`) holds `CartLine`s without `category`, so existing stored carts stay readable. Rollback is a plain revert.

  ### Design and tokens
  Built from the approved sketch `PROD-28OCT-STORY-049-wireframe.yaml`, screen `menu` (no `state_of` entries, so only the default state, plus the "No items match" state that AC 8 requires). Flows `to-cart` (open-cart) and `to-orders` (nav-orders) are exits: `open-cart` is the existing `CartButton` and drawer, and `nav-orders` is the existing Orders nav entry. Tokens load in `apps/web/src/app/globals.css` through the `@import` of `design-system/tokens.css` (after the tailwind import at the top). Styles are plain classes using `var(--token)`, which this plan continues. Reused components: `MenuGrid` (extended), `AddToCartControl`, `MenuCart`, `CartButton`, `CartProvider`, and the `.empty-state` pattern from `NoOrders`.

  ```mermaid
  flowchart TD
    page[app/menu/page.tsx] --> mg[MenuGrid]:::touched
    page --> mc[MenuCart]
    mg -->|filterMenu, menuCategories| menu[lib/menu.ts]:::touched
    mg -->|MENU_ITEMS with category| items[lib/menuItems.ts]:::touched
    mg --> atc[AddToCartControl]
    mg -->|add| cp[CartProvider]
    mc --> cb[CartButton badge count]
    cp --> cartlib[lib/cart.ts]
    css[globals.css]:::touched -.chip-group, 4:3 ratio.-> mg
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN: search, category chips, combined filtering and the "No items match" state on the existing `MenuGrid`, the `category` field on the seed, `lib/menu.ts`, the 4:3 image ratio and one Playwright spec. OUT: any change to the cart store, `CartButton`/`MenuCart`, TopBar, `MAIN_NAV`, Home, cart editing and checkout; those already exist from STORY-050 or belong to other stories. Riskiest part is changing the shape of `MenuItem` and `MenuGrid` markup that existing tests, `AddToCartControl` and the stored cart depend on, so `category` must not leak into cart lines. The 3-dish seed and the `auto-fill` grid are deliberate and listed as open questions.
