summary: |
  Add the cart drawer that opens over the Menu: a pure cart model (lines, quantities, total, remove, quantity-below-1 removes), a client cart store that keeps the cart in browser localStorage (surviving refresh and the trip through sign-in/registration at Checkout), and the approved drawer UI (CartDrawer, CartLine, QuantityStepper, Cart button with count badge, empty state, disabled Checkout, remove toast with Undo, guest note). Menu cards get an add-to-cart control that becomes a quantity stepper once the item is in the cart, and the Cart button opens the drawer. The Menu route belongs to STORY-049: if its page exists the cart is mounted into it with a minimal edit, and only if none exists does this story add a minimal public `/menu` fallback (placeholders Margherita Pizza ₹299, Cola ₹60, Garlic Bread ₹149), so ACs 1 and 10 stay verifiable end to end. A Menu entry is added to the top bar for guests and signed-in customers; sign-in is only needed at Checkout. All prices are Indian rupees (INR, for example ₹299 and ₹1,299). Checkout press navigates to `/checkout`, and sign-in is taught to return there; the Checkout screen itself stays out of scope (STORY-051).
scope:
  - description: |
      Pure cart model, no React. Types and functions:
      ```ts
      export type CartLine = { id: string; name: string; unitPrice: number; quantity: number; image: string };
      export type Cart = readonly CartLine[];
      export function addItem(cart: Cart, item: Omit<CartLine, "quantity">): Cart; // adds a line at 1, or +1 if present
      export function setQuantity(cart: Cart, id: string, quantity: number): Cart; // quantity < 1 removes the line
      export function increase(cart: Cart, id: string): Cart;
      export function decrease(cart: Cart, id: string): Cart; // from 1 removes the line
      export function removeLine(cart: Cart, id: string): Cart;
      export function cartTotal(cart: Cart): number; // sum of unitPrice * quantity
      export function cartCount(cart: Cart): number; // badge count
      export function formatMoney(amount: number): string; // INR, en-IN grouping, no trailing .00
      ```
      `formatMoney` is `new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 })`, so 299 gives ₹299 and 1299 gives ₹1,299 (and 125000 gives ₹1,25,000, the Indian lakh grouping).
    files:
      - apps/web/src/lib/cart.ts
      - apps/web/src/lib/cart.test.ts
    rationale: |
      Pure functions are testable with plain vitest, which is how lib/*.test.ts files already work. Covers ACs 3-7 and 14. Total is derived from lines, never stored, so it cannot drift.
  - description: |
      Cart persistence and store. `serializeCart(cart): string` and `parseCart(raw: string | null): Cart` (tolerates null, bad JSON and bad shapes by returning an empty cart). A client `CartProvider` plus `useCart()` hook exposing `{ cart, increase, decrease, remove, undoRemove, add }`, backed by localStorage under one key and hydrated after mount. The cart is browser-side only, for guests and signed-in customers alike, so the same lines are there after the full-page navigation to /sign-in or /register and back to Checkout. `add` is called by the Menu cards. Persisted lines keep `id`, `name`, `unitPrice`, `quantity` and `image`; `parseCart` rejects a line missing any of them. The cart is hydrated from storage after mount, so it persists across page refreshes and across the full-page navigation to sign-in and back.
    files:
      - apps/web/src/lib/cartStorage.ts
      - apps/web/src/lib/cartStorage.test.ts
      - apps/web/src/components/cart/CartProvider.tsx
    rationale: |
      Covers AC 13 and the settled decision that the guest cart is kept through sign-in. Nothing is stored server side, so there is no schema or API change. Parse tolerance means a corrupted value never breaks the Menu.
  - description: |
      Drawer UI, taken from the approved prototype. `CartDrawer` is a right-hand `.drawer` (`role="dialog"`, `aria-modal="true"`, `aria-label="Your cart"`) with a `.backdrop`. Header holds an h2 "Your cart" and a ghost icon close button (aria-label "Close cart"). Body is either the `<ul class="cart-lines" aria-label="Items in your cart">` of `CartLine` rows or the `.empty-state` (bag icon, h3 "Your cart is empty", text "Add a dish from the menu and it will show up here.", secondary "Back to menu" button that dismisses). Footer has the total row (`Total`, `aria-live="polite"` amount) and the one `.btn-primary .btn-lg` "Checkout", disabled when there are no lines. `CartLine` shows the line's `image` in the prototype's `.cart-thumb` box (size-control square, `object-fit: cover`, empty alt because the name sits beside it), name, "{price} each", line subtotal, a `QuantityStepper` and a ghost "Remove" button. `QuantityStepper` is minus, quantity, plus; at quantity 1 the minus becomes a bin icon labelled "Remove {name}" (so below 1 removes). Controls are 44px min (prototype `.stepper .btn`). Guest note is an `.alert .alert-info` "Not signed in? You'll sign in at Checkout and your cart stays as it is." shown for guests only when there are lines. Remove (the Remove button, not the stepper) shows the existing `Toast` with an Undo action, so `Toast` gets an optional `action` prop: `{ label: string; onAction: () => void }`. `CartButton` is the secondary "Cart" button with a bag icon and a `.badge-neutral` count, aria-label "Open cart". Escape and backdrop click dismiss; focus moves into the drawer on open and back to the Cart button on close, with Tab trapped (as the prototype kit does).
      ```tsx
      export function CartDrawer(props: {
        open: boolean; cart: Cart; signedIn: boolean;
        onClose: () => void; onIncrease: (id: string) => void; onDecrease: (id: string) => void;
        onRemove: (id: string) => void; onCheckout: () => void;
      }): JSX.Element | null
      ```
      Checkout calls `onCheckout`, which the host wires to `router.push(CHECKOUT_HREF)`. Tokens used: `--space-1/2/3/4`, `--size-drawer`, `--size-control`, `--size-control-lg`, `--color-bg`, `--color-border`, `--color-border-strong`, `--color-fg-muted`, `--color-overlay`, `--opacity-backdrop`, `--z-overlay`, `--z-modal`, `--radius-md`, `--font-size-sm`, `--font-size-lg`, `--font-weight-medium`, `--font-weight-semibold`, `--border-width`, `--color-bg-subtle`. Reuse: `Icon` (add `plus`, `minus`, `trash` paths copied from the prototype sprite), `Toast`, and the existing `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`, `.badge-neutral`, `.alert-info`, `.empty-state` classes.
    files:
      - apps/web/src/components/cart/CartDrawer.tsx
      - apps/web/src/components/cart/CartDrawer.test.tsx
      - apps/web/src/components/cart/CartLine.tsx
      - apps/web/src/components/cart/CartLine.test.tsx
      - apps/web/src/components/cart/QuantityStepper.tsx
      - apps/web/src/components/cart/QuantityStepper.test.tsx
      - apps/web/src/components/cart/CartButton.tsx
      - apps/web/src/components/orders/Icon.tsx
      - apps/web/src/components/appointments/Toast.tsx
    rationale: |
      Mirrors the prototype's Cart and Cart-empty screens. The catalogue has no cart or stepper component, so these are new; Icon, Toast and the button/badge/alert/empty-state classes are extended or reused rather than rebuilt. The prototype's "Back to menu" lives in the empty state as its one action.
  - description: |
      Styles for the new classes (`.drawer`, `.drawer-header/-body/-footer`, `.backdrop`, `.cart-lines`, `.cart-line`, `.cart-thumb`, `.stepper`, `.stepper-qty`, `.cart-total-row`, `.btn-lg`, `.btn-icon`, `.btn-danger` not needed), copied from the prototype's inlined prototype-utils.css and `<style>` block, appended to globals.css as one commented section. Only `var(--token)` values, no colour literals. The prototype's `.drawer { top: 46px }` is an offset for the reviewer bar and is NOT carried over; the real drawer is `top: 0`. Tokens are already loaded by `@import "../../../../design-system/tokens.css"` at apps/web/src/app/globals.css:2.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      Existing screens copy their prototype CSS into globals.css the same way (see its section comments).
  - description: |
      Wire the drawer into the app and the checkout round trip. `shell.ts` already exports no menu or checkout paths, so add `MENU_HREF = "/menu"` and `CHECKOUT_HREF = "/checkout"` and add `checkout: CHECKOUT_HREF` to `NEXT_TARGETS` so `signInTarget("checkout")` returns `/checkout`. `app/layout.tsx` wraps children in `CartProvider`. A client `MenuCart` host renders `CartButton` plus `CartDrawer` with the open state (`cartDrawerReducer`), and its Checkout handler pushes `CHECKOUT_HREF`. Checkout, when pressed by a guest, goes to `/checkout`; the Checkout page (STORY-051) will redirect guests to `/sign-in?next=checkout`, so the lines are still in storage when they return. No `/checkout` page is built here, so until STORY-051 lands that route 404s.
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/src/app/layout.tsx
      - apps/web/src/components/cart/MenuCart.tsx
    rationale: |
      Covers ACs 1, 10, 12 and 13 at the wiring level. `signInTarget` keeps its allow-list, so the new target adds no open redirect.
  - description: |
      Menu card control, always built and route-neutral. `AddToCartControl` takes a menu item and the cart: when the item is not in the cart it renders a secondary "Add to cart" button calling `useCart().add`; once in the cart it renders the existing `QuantityStepper` (bin at 1, so items can be removed from the Menu as well as the drawer). It is a component that whichever Menu page exists mounts inside each card; it owns no route.
      ```ts
      export function AddToCartControl(props: { item: Omit<CartLine, "quantity">; cart: Cart;
        onAdd: (item: Omit<CartLine, "quantity">) => void; onIncrease: (id: string) => void;
        onDecrease: (id: string) => void }): JSX.Element
      ```
    files:
      - apps/web/src/components/cart/AddToCartControl.tsx
      - apps/web/src/components/cart/AddToCartControl.test.tsx
    rationale: |
      Lets the Menu add and remove items without this story owning the Menu route or its cards.
  - description: |
      Mounting on the Menu page, with ownership kept on STORY-049. Step 1 at implementation time: check whether `apps/web/src/app/menu/page.tsx` exists (I looked in this worktree with Glob `apps/web/src/**/menu/**` and found nothing, but STORY-049 may have merged since). 
      (a) If it exists, REUSE it: do not rewrite it or its grid. Make only the smallest integration edit, mounting `<MenuCart signedIn={...} />` in its header and `<AddToCartControl />` in its cards, and leave any search, filter or layout logic untouched; add or extend its test only for the cart pieces. It stays public (no sign-in redirect).
      (b) If it does not exist, build the minimal fallback below so ACs 1 and 10 stay verifiable, and say in the PR that STORY-049 should adopt or replace it, keeping `MenuCart` and `AddToCartControl`.
      Fallback: a public server page `app/menu/page.tsx` (no `getSession` redirect, since guests must browse and build a cart) with the h1 "Menu" in the title-row layout, `MenuCart` in the header (`signedIn={(await getSession()) !== null}`, treated as guest if the lookup throws, like Home), and `MenuGrid`, a `.grid` of `.card`s showing image, name, `formatMoney(unitPrice)` and `AddToCartControl`. `MENU_ITEMS` is a static in-code list (no catalogue API); names, prices and images are placeholders that product can replace without touching cart code, because the cart only stores what `add` is given.
      ```ts
      export type MenuItem = { id: string; name: string; unitPrice: number; image: string };
      export const MENU_ITEMS: readonly MenuItem[] = [
        { id: "margherita", name: "Margherita Pizza", unitPrice: 299, image: "/menu/margherita.svg" },
        { id: "cola", name: "Cola", unitPrice: 60, image: "/menu/cola.svg" },
        { id: "garlic-bread", name: "Garlic Bread", unitPrice: 149, image: "/menu/garlic-bread.svg" },
      ];
      ```
    files:
      - apps/web/src/app/menu/page.tsx
      - apps/web/src/app/menu/page.test.tsx
      - apps/web/src/components/menu/MenuGrid.tsx
      - apps/web/src/components/menu/MenuGrid.test.tsx
      - apps/web/src/lib/menuItems.ts
      - apps/web/public/menu/margherita.svg
      - apps/web/public/menu/cola.svg
      - apps/web/public/menu/garlic-bread.svg
    rationale: |
      Honours the reviewer's rule of one owner per route: the page, grid and placeholder catalogue files are created ONLY in case (b); in case (a) the only touched file from this list is the existing page (and its test). Mirrors the prototype's Menu screen (h1, Cart button with badge, grid of cards with name and price). No search, filter or item detail, which belong to other Menu stories.
  - description: |
      Top-bar Menu entry for guests and signed-in customers. `NavEntry` gets an optional `public?: true`; append `{ key: "menu", label: "Menu", href: MENU_HREF, public: true }` to the END of `MAIN_NAV` so existing positions stay stable. `visibleNav(signedIn)` returns `MAIN_NAV` when signed in and `MAIN_NAV.filter((e) => e.public)` (just Menu) for guests. `TopBar` now renders the brand group, the narrow-screen "Menu" toggle button and `<nav id="main-nav">` for guests too; "Sign out" and the sign-out error alert stay signed-in only. The brand still links to sign-in for guests (`brandHref`). Guests are never redirected from `/menu`; sign-in is only demanded at Checkout.
      ```ts
      export type NavEntry = { key: string; label: string; href: string; public?: true };
      export function visibleNav(signedIn: boolean): readonly NavEntry[] {
        return signedIn ? MAIN_NAV : MAIN_NAV.filter((entry) => entry.public);
      }
      ```
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBar.test.tsx
    rationale: |
      Reviewer asked for it. It reverses two existing assertions that this story must update: shell.test.ts `expect(visibleNav(false)).toEqual([])` and the TopBar signed-out test that expects no `data-nav-key` and no "Menu" text. Both are replaced, not deleted, by the guest assertions listed in tests. The wallet-at-index-1 assertion still holds because Menu is appended last. No mobile layout change: the existing `.shell-menu-btn` and `.shell-nav` rules already serve this.
tests:
  - |
    AC1 (apps/web/src/components/cart/CartDrawer.test.tsx). Written first, fails until CartDrawer exists.
    ```ts
    const html = renderToStaticMarkup(<CartDrawer open cart={cart} signedIn={false} {...noop} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Your cart"');
    expect(renderToStaticMarkup(<CartDrawer open={false} cart={cart} signedIn={false} {...noop} />)).toBe("");
    ```
    Also a CartButton test: `expect(html).toContain('aria-label="Open cart"')` and the count badge shows 3. On the Menu, AddToCartControl.test.tsx (always): an item not in the cart renders "Add to cart", and one in the cart renders the stepper. In the Menu page's own test (the existing page's test in case (a), the fallback page.test.tsx and MenuGrid.test.tsx in case (b)): the markup contains the Cart button and the cart controls; in case (b) also the placeholder names and prices.
    ```ts
    expect(html).toContain("Margherita Pizza");
    expect(html).toContain("₹299");
    expect(html).toContain('aria-label="Open cart"');
    ```
    Plus the pure reducer `cartDrawerReducer(false, "open")` returns `true`.
  - |
    AC2 (CartDrawer.test.tsx), cart is 2 Margherita and 1 Cola.
    ```ts
    expect(html).toMatch(/Margherita/); expect(html).toMatch(/Cola/);
    expect(html).toContain('aria-label="Quantity 2"'); expect(html).toContain('aria-label="Quantity 1"');
    expect(html).toContain('src="/menu/margherita.svg"'); // the line's own image
    ```
  - |
    AC3 (cart.test.ts). Pure model; the stepper's plus button also gets a QuantityStepper markup test that it carries `aria-label="Increase quantity of Margherita"`.
    ```ts
    const m = { id: "m", name: "Margherita", unitPrice: 10, quantity: 2, image: "/menu/margherita.svg" };
    expect(increase([m], "m")[0].quantity).toBe(3);
    expect(addItem([], { id: "m", name: "Margherita", unitPrice: 10, image: m.image })[0].quantity).toBe(1);
    ```
  - |
    AC4 (cart.test.ts).
    ```ts
    expect(decrease(cart2, "m")[0].quantity).toBe(1);
    ```
  - |
    AC5 (cart.test.ts), one Margherita line, quantity 2, unit price 10.
    ```ts
    expect(cartTotal(cart2)).toBe(20);
    expect(cartTotal(increase(cart2, "m"))).toBe(30);
    ```
    CartDrawer markup test renders the 30 total: `expect(html).toContain(formatMoney(30))`. INR formatting (cart.test.ts), covering the reviewer's examples:
    ```ts
    expect(formatMoney(299)).toBe("₹299");
    expect(formatMoney(1299)).toBe("₹1,299");
    expect(formatMoney(125000)).toBe("₹1,25,000");
    expect(formatMoney(299)).not.toContain("$");
    ```
  - |
    AC6 (cart.test.ts and CartDrawer.test.tsx), 2 Margherita and 1 Cola.
    ```ts
    expect(removeLine(cart, "m").map((l) => l.name)).toEqual(["Cola"]);
    ```
    Drawer rendered with the reduced cart: `expect(html).not.toContain("Margherita")`.
  - |
    AC7 (cart.test.ts).
    ```ts
    expect(cartTotal(cart)).toBe(23);
    expect(cartTotal(removeLine(cart, "m"))).toBe(3);
    ```
  - |
    AC8 (CartDrawer.test.tsx), empty cart.
    ```ts
    expect(html).toContain("Your cart is empty");
    expect(html).toContain('class="empty-state"');
    ```
  - |
    AC9 (CartDrawer.test.tsx), cart with lines.
    ```ts
    expect(html).not.toContain("Your cart is empty");
    ```
  - |
    AC10. Pure toggle covered by CartDrawer markup (`open={false}` renders nothing, so the Menu is shown with the drawer closed) plus a MenuCart host test with the open state extracted into an exported reducer `cartDrawerReducer(open: boolean, action: "open" | "close"): boolean`.
    ```ts
    expect(cartDrawerReducer(true, "close")).toBe(false);
    ```
    Dismiss paths (close button, Escape, backdrop, "Back to menu") all call `onClose`; a test asserts `aria-label="Close cart"` and `data-backdrop` are in the markup.
  - |
    AC11 (CartDrawer.test.tsx), cart with lines.
    ```ts
    expect(html).toMatch(/<button[^>]*class="btn btn-primary btn-lg"[^>]*>Checkout</);
    expect(html).not.toMatch(/class="btn btn-primary btn-lg"[^>]*disabled/);
    ```
  - |
    AC12. CartDrawer calls `onCheckout` for the Checkout button; the handler is exported as a plain function `handleCheckout(deps: { push: (href: string) => void; close: () => void })` so it is testable without a DOM.
    ```ts
    const push = vi.fn(); handleCheckout({ push, close: vi.fn() });
    expect(push).toHaveBeenCalledWith("/checkout");
    ```
  - |
    AC13 (cartStorage.test.ts and shell.test.ts). The cart written before the redirect to sign-in is the cart read after it:
    ```ts
    expect(parseCart(serializeCart(cart))).toEqual(cart);
    expect(signInTarget("checkout")).toBe("/checkout");
    ```
    A line keeps all five fields through storage (so refresh and sign-in both restore image and price too): `expect(parseCart(serializeCart(cart))[0]).toEqual({ id: "m", name: "Margherita", unitPrice: 10, quantity: 2, image: "/menu/margherita.svg" })`. Robustness cases: `parseCart(null)`, `parseCart("not json")` and `parseCart('[{"itemId":1}]')` all return `[]`. Guest note is asserted in CartDrawer markup for `signedIn={false}` and absent for `signedIn`.
  - |
    AC14 (cart.test.ts), a line at quantity 1.
    ```ts
    expect(decrease(cart1, "m")).toEqual([]);
    expect(setQuantity(cart1, "m", 0)).toEqual([]);
    ```
    QuantityStepper markup at quantity 1: `expect(html).toContain('aria-label="Remove Margherita"')` and at quantity 2 `'aria-label="Decrease quantity of Margherita"'`.
  - |
    AC15 (CartDrawer.test.tsx), empty cart.
    ```ts
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Checkout</);
    ```
  - |
    Top-bar Menu entry (shell.test.ts and TopBar.test.tsx), replacing the old guest assertions. Menu is visible to guests and signed-in customers and is last in the nav.
    ```ts
    expect(visibleNav(false)).toEqual([{ key: "menu", label: "Menu", href: "/menu", public: true }]);
    expect(visibleNav(true).at(-1)?.key).toBe("menu");
    expect(visibleNav(true)[1]).toEqual({ key: "wallet", label: "Wallet", href: "/wallet" }); // unchanged
    // TopBar signed out
    expect(html).toMatch(/<a[^>]*data-nav-key="menu"[^>]*href="\/menu"|<a[^>]*href="\/menu"[^>]*data-nav-key="menu"/);
    expect(html).not.toContain("Sign out");
    expect(renderToStaticMarkup(<TopBar signedIn={false} pathname="/menu" />)).toMatch(/data-nav-key="menu"[^>]*aria-current="page"/);
    ```
    The signed-in TopBar tests stay as they are, and a guest `/menu` is never redirected (the page has no `redirect(` call).
    Verify each with the narrow form of the project command, e.g. `cd apps/web && pnpm test src/lib/cart.test.ts src/components/cart`.
assumptions_or_open_questions:
  - |
    Menu page ownership. Decided with the reviewer: STORY-049 owns `apps/web/src/app/menu/page.tsx`, so if it exists this story reuses it with only a minimal cart mount and never rewrites it. I searched this worktree (Glob `apps/web/src/**/menu/**`) and no Menu page exists at planning time, so the fallback page is planned but conditional. Please confirm whether STORY-049 has merged or is about to, since that decides which case applies; if it is still in flight, the safer option may be to land STORY-049 first and skip the fallback entirely. In that case ACs 1 and 10 are covered at component level (CartDrawer, AddToCartControl) until it lands.
  - |
    Placeholder catalogue approved for MVP/demo: Margherita Pizza ₹299, Cola ₹60, Garlic Bread ₹149, with placeholder SVGs under `apps/web/public/menu/` (only built in the fallback case). Product can replace names, prices and images later without touching cart code. The AC fixtures (unit price 10 and 3, totals 20, 30, 23) stay as test-only data, unchanged.
  - |
    Decided with the reviewer: cart lines carry id, name, unitPrice, quantity and image; storage is browser localStorage only (no server cart or merge), persisting across refresh and sign-in on the same device; currency is INR with en-IN formatting (₹299, ₹1,299). The prototype's `$` amounts and USD formatter are not followed.
  - |
    Decided with the reviewer: a Menu entry is added to the top-bar nav for guests and signed-in customers, last in the list, and guests browse `/menu` without signing in; authentication is only required at Checkout. This changes the old "guests see the brand only" behaviour, which the UI guidelines' nav rule (add sections to the end) allows. The Cart button stays on the Menu screen as in the prototype, not in the top bar. A guest's brand link still goes to sign-in (unchanged).
  - |
    The prototype has both a stepper bin (at quantity 1) and a separate "Remove" button on each line, and only the Remove button shows the Undo toast. The stepper bin and "decrease below 1" (AC14) remove without Undo. I kept both as drawn.
  - |
    The prototype's "Checkout" shows "Opening checkout…" for 300ms, a prototype stub that I did not build. The real button navigates immediately.
  - |
    The open questions on order and contact-detail retention (EPIC-026, CHORE-042) are not touched here: this story stores no orders, accounts or contact details, only a browser cart.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  None — the cart lives in the browser's localStorage under a new key. No database schema, API payload, seed, env var or config file changes. The three menu images are static files in apps/web/public/menu/ shipped with the build. Rollback is reverting the code; a leftover localStorage value is ignored because `parseCart` tolerates unknown shapes.

  ### Design and tokens

  Read the prototype PROD-28OCT-STORY-050-design.html in full. Screens: Menu (Cart button opens the drawer), Cart (drawer open with 2 Margherita and 1 Cola, guest note), Cart — empty (message, disabled Checkout). Tokens load through `@import "../../../../design-system/tokens.css"` at apps/web/src/app/globals.css:2, so every new style uses `var(--token)` names from that file. The prototype's own drawer offset (`top: 46px`) and the "Menu" stub grid are prototype scaffolding and are not built.

  Test approach: existing component tests use `renderToStaticMarkup` from react-dom/server with vitest (see components/orders/NoOrders.test.tsx), with no DOM or testing-library. Behaviour is therefore kept in pure functions (cart.ts, cartStorage.ts, `handleCheckout`, `cartDrawerReducer`) that are tested directly, the same pattern as `handleSignIn` in SignInForm.tsx.

  ```mermaid
  flowchart TD
    Layout[app/layout.tsx] -->|wraps with CartProvider| Provider[CartProvider]
    MenuPage[app/menu/page.tsx STORY-049 owns, mount only] --> MenuCart
    MenuPage --> Add[AddToCartControl]
    Add --> Stepper
    Add --> Provider
    MenuPage -.->|fallback only| Grid[menu/MenuGrid]
    Grid -.-> MenuItems[lib/menuItems.ts]
    TopBar[TopBar.tsx] -->|guest and signed-in Menu entry| Shell
    MenuPage -->|signedIn flag| Session[lib/session.ts getSession]
    Provider --> Model[lib/cart.ts]
    Provider --> Storage[lib/cartStorage.ts]
    MenuCart[MenuCart] --> Button[CartButton]
    MenuCart --> Drawer[CartDrawer]
    Drawer --> Line[CartLine]
    Line --> Stepper[QuantityStepper]
    Drawer --> Toast[appointments/Toast]
    Line --> Icon[orders/Icon]
    MenuCart -->|Checkout| Shell[lib/shell.ts CHECKOUT_HREF]
    SignIn[SignInForm via signInTarget] --> Shell
    classDef touched fill:#f96,color:#000
    class Layout,Provider,Model,Storage,MenuCart,Button,Drawer,Line,Stepper,Toast,Icon,Shell,MenuPage,Add,Grid,MenuItems,TopBar touched
  ```
review_focus: |
  IN: cart state, localStorage persistence, the drawer UI and card add/stepper control from the approved prototype, a minimal cart mount on the Menu page, the Checkout navigation plus sign-in return target, and a Menu top-bar entry for guests and signed-in users. OUT: the Menu page itself (STORY-049 owns the route; a minimal `/menu` fallback is built ONLY if no page exists, so flag any rewrite or restyle of an existing Menu page), the Checkout screen and order placement (STORY-051), and any server-side cart. Riskiest areas: route ownership of `/menu`, persistence across refresh and the sign-in round trip (AC13) since localStorage is only readable after mount, and the TopBar guest change that overturns an existing test. Deliberate: lines carry their own id, name, unitPrice, quantity and image, prices are INR (en-IN, `₹1,299`) not the prototype's USD, placeholder menu data is approved, and the prototype's reviewer-bar offset and "Opening checkout…" stub are not built.
