summary: |
  Add a signed-in-only `/orders` page to the Web App (comp_web_app, Next.js + Tailwind v4 + vitest/playwright). It shows the approved prototype's "Your orders" screen: Active and Past tabs, read-only order rows (title, order number, status badge with icon + word, placed time), newest first, loaded a page at a time with a spinner row while a page loads and an inline error row with Retry when a later page fails (already-loaded rows stay). A customer with no orders sees the "No orders" empty state whose single primary action "Browse the menu" goes to the Menu. A signed-out visitor is redirected to `/sign-in` carrying a safe `next=/orders` so the sign-in item can return them to Orders. Orders is appended to the top-bar nav. The Records API has no orders or session endpoints today, so the web app consumes an assumed `GET /orders` seam (same pattern as `lib/session.ts`) that an e2e mock server stands in for; building the API endpoint is out of scope and is called out as an open question.
scope:
  - description: |
      Pure orders logic (no React), the unit-test heart of the change. Types, tab classification, paging merge, and the fetch seam.

      ```ts
      export type OrderStatus = "Received" | "Preparing" | "Ready for pickup" | "Fulfilled" | "Cancelled";
      export type Order = { id: string; number: string; title: string; status: OrderStatus; placedAt: string };
      export type OrdersTab = "active" | "past";
      export type OrdersPage = { items: Order[]; nextCursor: string | null; hasAnyOrders: boolean };
      export const ORDERS_PAGE_SIZE = 20;
      export function tabOf(status: OrderStatus): OrdersTab;               // Fulfilled | Cancelled -> "past", else "active"
      export function mergePage(loaded: Order[], page: Order[]): Order[];   // dedupe by id, newest placedAt first
      export function fetchOrdersPage(tab: OrdersTab, cursor: string | null): Promise<OrdersPage>; // client; throws on !res.ok
      export function ordersSignInHref(): string;                           // "/sign-in?next=%2Forders"
      ```

      The paging state machine is a reducer so every state is testable under the repo's `environment: "node"` vitest config:
      `type TabState = { items: Order[]; nextCursor: string | null; status: "loading-first" | "idle" | "loading-more" | "error-more" }`
      with actions `first-loaded`, `more-requested`, `more-loaded`, `more-failed`. `more-failed` keeps `items` untouched (AC 12).
    files:
      - apps/web/src/lib/orders.ts
      - apps/web/src/lib/orders.test.ts
    rationale: |
      Classification (AC 9, 10), newest-first (AC 3), paging states (AC 5, 11, 12) and the signed-out target (AC 8, 13) are all logic. Keeping them out of components follows how TopBarControls exports `handleSignOut` with injected deps for node-env tests.
  - description: |
      Server-rendered route `/orders`. Gate on `getSession()`; when it returns null, `redirect(ordersSignInHref())` so Orders markup is never rendered (AC 8). Otherwise render `<OrdersScreen />`. The root layout already calls `getSession()` and renders the top bar; the page does its own call because pages cannot read the layout's value.

      ```tsx
      export default async function OrdersPage() {
        if ((await getSession()) === null) redirect(ordersSignInHref());
        return <OrdersScreen />;
      }
      ```
    files:
      - apps/web/src/app/orders/page.tsx
    rationale: |
      Matches the existing server-side session seam in `apps/web/src/lib/session.ts` and the layout. AC 13: the `next` param is the hand-off; the sign-in item (not in this repo yet) must honour it.
  - description: |
      Client component `OrdersScreen` plus small presentational parts, matching the prototype's "Orders" and "No orders" screens.
      - `OrdersScreen` ("use client"): h1 "Your orders"; Active/Past tabs (`role="tablist"`, buttons `role="tab"` with `aria-selected`, ArrowLeft/ArrowRight move and select, `role="tabpanel"`); one `TabState` per tab via `useReducer`, first page fetched on mount and on first visit to a tab; a sentinel element observed with `IntersectionObserver` fetches the next page automatically while `nextCursor !== null` and status is `idle`.
      - First page loading: 3 `.card` skeleton rows (`role="status"`, `aria-label="Loading your orders"`) as in the prototype.
      - Rows: `<ul class="order-list" aria-label="Active orders|Past orders">` of `OrderRow` (`<li class="card order-row">`, title `.order-row-title`, meta `Order #1048, placed 28 Oct, 12:40`, `OrderStatusBadge`). Rows are not links, buttons or handlers, no chevron, `cursor: default` (AC 4).
      - `OrderStatusBadge`: `.badge` + tone and icon + word. Received `badge-info` info icon, Preparing `badge-warning` loader icon, Ready for pickup `badge-success` bell icon, Fulfilled `badge-success` check icon, Cancelled `badge-danger` x icon (icons are inline SVG, `aria-hidden`, stroke `currentColor`, same paths as the prototype's sprite).
      - Next page loading: `<div class="state-row" role="status"><span class="spinner" aria-hidden="true"/>Loading more orders…</div>` under the list (AC 5).
      - Next page failed: `<div class="alert alert-danger" role="alert">` with alert icon, text "We couldn't load more orders. Your other orders are still shown. Check your connection and try again." and a `.btn btn-secondary btn-sm` "Retry" that re-requests the same cursor (AC 11, 12).
      - Empty tab while the other has orders: `.state-row` "You have no active orders right now. Past orders are under the Past tab." (Past: "You have no past orders yet.").
      - `NoOrders` (when the first page of either tab reports `hasAnyOrders: false`): same heading and tabs; panel holds `.empty-state` with bag icon, h2 "You have no orders yet", p "When you place an order, you can follow it here." and one `<a class="btn btn-primary" href="/menu">Browse the menu</a>` (AC 6, 7).
      - First-page failure (not in the prototype): reuse the same `.alert-danger` + Retry markup in place of the list.
    files:
      - apps/web/src/components/orders/OrdersScreen.tsx
      - apps/web/src/components/orders/OrderRow.tsx
      - apps/web/src/components/orders/OrderStatusBadge.tsx
      - apps/web/src/components/orders/NoOrders.tsx
      - apps/web/src/components/orders/OrdersScreen.test.tsx
      - apps/web/src/components/orders/OrderRow.test.tsx
      - apps/web/src/components/orders/NoOrders.test.tsx
    rationale: |
      No catalogue component covers tabs, rows or empty states (TopBar, TopBarControls and the paragraph blocks are unrelated), so these are new, built only from design-system classes. `OrdersScreen` takes its fetcher as a prop defaulting to `fetchOrdersPage` so tests inject fakes, mirroring `handleSignOut(deps, ...)`.
  - description: |
      Styles. `apps/web/src/app/globals.css` already imports tokens at line 2 (`@import "../../../../design-system/tokens.css";`) and today only copies `.btn`, `.btn-secondary`, `.btn-ghost`, `.btn-sm` and `.alert` from `design-system/prototype-utils.css`. Add, copied from that file and the prototype, only what is missing, using tokens only: `.stack`/`.stack-1`/`.stack-2`/`.stack-4`, `.btn-primary` (+ hover/active), `.tabs`, `.tab` (+ selected, hover, focus-visible), `.tab-panel`, `.card`, `.badge` + `.badge-info|success|warning|danger`, `.skeleton`, `.spinner` + `@keyframes ds-spin`, `.empty-state`, `svg.icon`, and the prototype's `.page`-free page layout (the shell already centres at `--size-shell-max`, so no `.page` card), `.order-list`, `.order-row`, `.order-row-main`, `.order-row-title`, `.order-meta`, `.order-badge`, `.state-row`.
      Tokens used: --space-1..4, --space-6, --radius-sm|md|lg|full, --border-width, --border-width-strong, --color-border, --color-border-strong, --color-bg, --color-bg-subtle, --color-fg, --color-fg-muted, --color-primary, --color-primary-fg, --color-primary-hover, --color-primary-active, --color-focus, --color-skeleton, --card-default-*, --badge-*-background/foreground, --font-size-sm|lg, --font-weight-medium|semibold, --size-control, --size-skeleton-line, --size-spinner, --size-focus-offset, --motion-spinner-ms. No colour literals or raw px (the 768px media query already exists as the documented literal).
    files:
      - apps/web/src/app/globals.css
    rationale: |
      The prototype's own inline `<style>` block (.order-list, .order-row, .order-meta, .state-row, .skeleton-row) plus prototype-utils.css define the look; copying them keeps the build faithful to the approved design.
  - description: |
      Navigation and API reach. Append the Orders destination to the end of `MAIN_NAV` so Home keeps position 0:

      ```ts
      export const ORDERS_HREF = "/orders";
      export const MAIN_NAV: readonly NavEntry[] = [
        { key: "home", label: "Home", href: HOME_HREF },
        { key: "orders", label: "Orders", href: ORDERS_HREF },
      ];
      ```

      `isCurrent` already handles non-root hrefs by prefix. `next.config.ts` gains a rewrite so the browser's `/orders` calls reach the API with cookies, like `/session/*`. Note that `/orders` is also the page path, so the data endpoint is rewritten under `/api/orders` instead:
      `{ source: "/api/orders", destination: `${apiUrl}/orders` }`; `fetchOrdersPage` calls `/api/orders?tab=active|past&limit=20&cursor=...`.
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/next.config.ts
    rationale: |
      UI guidelines: new sections go at the end of the nav. The page route and the data route must not collide, hence `/api/orders`.
  - description: |
      Playwright e2e. Extend `tests/e2e/mock-session-server.mjs` with `GET /orders?tab&limit&cursor` serving a fixed fixture (the prototype's eight orders, plus enough extras for 2+ pages at limit 5) and honouring cookies: `e2e-orders=none` returns no orders, `e2e-orders=fail-page-2` makes any request with a cursor return 500. Add `tests/e2e/orders.spec.ts` covering the behaviours that need a real browser (tabs, spinner, retry, row click inert, empty-state link, signed-out redirect).
    files:
      - apps/web/tests/e2e/mock-session-server.mjs
      - apps/web/tests/e2e/orders.spec.ts
    rationale: |
      The existing e2e seam already fakes the API for the session; the same server is the natural place for the orders fixture.
tests:
  - |
    AC1, tabs. In `OrdersScreen.test.tsx`: `const html = renderToStaticMarkup(<OrdersScreen initial=... />)`;
    `expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Active</)` and `expect(html).toMatch(/role="tab"[^>]*>Past</)`. e2e: `await expect(page.getByRole("tab", { name: "Active" })).toBeVisible()` and the same for Past.
  - |
    AC2, row content. In `OrderRow.test.tsx`: render `<OrderRow order={{ id: "o1", number: "1048", title: "Lunch for two", status: "Preparing", placedAt: "2026-10-28T12:40:00Z" }} />` and
    `expect(html).toContain("Lunch for two"); expect(html).toContain("Order #1048"); expect(html).toContain("Preparing");`. Also assert each of the five statuses renders its word plus an `<svg` (colour never the only signal).
  - |
    AC3, newest first. In `orders.test.ts`:
    `expect(mergePage([], [older, newest, middle]).map((o) => o.id)).toEqual(["new", "mid", "old"]);` and that merging a later page keeps global order and drops a duplicate id:
    `expect(mergePage([newest], [newest, older])).toHaveLength(2);`.
  - |
    AC4, rows inert. In `OrderRow.test.tsx`: `expect(html).not.toMatch(/<(a|button)\b/); expect(html).not.toContain("onClick"); expect(html).not.toContain("href=");`. e2e: record `page.url()`, `await page.locator(".order-row").first().click()`, then `await expect(page).toHaveURL(before)` and the list is still visible.
  - |
    AC5, loading indicator. In `orders.test.ts` reducer: `expect(reducer(idleWithMore, { type: "more-requested" }).status).toBe("loading-more")`. In `OrdersScreen.test.tsx`: a state with `status: "loading-more"` renders `Loading more orders` and `role="status"`; `loading-first` renders `aria-label="Loading your orders"`. e2e: delay the second mock response and `await expect(page.getByText("Loading more orders")).toBeVisible()`.
  - |
    AC6, No orders screen. In `NoOrders.test.tsx` and `OrdersScreen.test.tsx`: with a first page `{ items: [], nextCursor: null, hasAnyOrders: false }` the markup contains `You have no orders yet` and `class="empty-state"` and no `order-list`. e2e with cookie `e2e-orders=none`: `await expect(page.getByText("You have no orders yet")).toBeVisible()`.
  - |
    AC7, Browse the menu. In `NoOrders.test.tsx`: `expect(html).toMatch(/<a[^>]*class="btn btn-primary"[^>]*href="\/menu"[^>]*>Browse the menu</)` and exactly one `btn-primary` in the view. e2e: click the link and `await expect(page).toHaveURL(/\/menu$/)` (the Menu screen itself belongs to another item, so only the navigation is asserted).
  - |
    AC8, signed-out gate. In `orders.test.ts`: `expect(ordersSignInHref()).toBe("/sign-in?next=%2Forders")`. In `apps/web/src/app/orders/page.test.tsx` mock `@/lib/session` `getSession` to resolve null and `next/navigation` `redirect` to throw a sentinel; `await expect(OrdersPage()).rejects.toThrow("REDIRECT")` and `expect(redirect).toHaveBeenCalledWith("/sign-in?next=%2Forders")`; with a session, the result is an `OrdersScreen` element. e2e (no cookie): `await page.goto("/orders"); await expect(page).toHaveURL(/\/sign-in\?next=%2Forders$/); await expect(page.getByRole("tab")).toHaveCount(0)`.
  - |
    AC9, Active tab. In `orders.test.ts`: `for (const s of ["Received", "Preparing", "Ready for pickup"] as const) expect(tabOf(s)).toBe("active");`. `fetchOrdersPage("active", null)` is tested with a stubbed `fetch` to assert the request URL contains `tab=active` and `limit=20`.
  - |
    AC10, Past tab. In `orders.test.ts`: `expect(tabOf("Fulfilled")).toBe("past"); expect(tabOf("Cancelled")).toBe("past");` and the Past request uses `tab=past`. e2e: Fulfilled and Cancelled fixture titles are visible on Past and `toHaveCount(0)` on Active.
  - |
    AC11, later-page failure. In `orders.test.ts` reducer: `expect(reducer(loadingMore, { type: "more-failed" }).status).toBe("error-more")`. In `OrdersScreen.test.tsx`: an `error-more` state renders `role="alert"`, the text `We couldn't load more orders` and `>Retry<`. A fetch-failure test: stubbed `fetch` returning `{ ok: false, status: 500 }` makes `fetchOrdersPage` reject. e2e with `e2e-orders=fail-page-2`: scroll to the end, `await expect(page.getByRole("alert")).toContainText("couldn't load more orders")`; clearing the cookie and clicking Retry loads the next rows.
  - |
    AC12, loaded rows stay. In `orders.test.ts` reducer: `const next = reducer(loadingMore, { type: "more-failed" }); expect(next.items).toEqual(loadingMore.items);`. In `OrdersScreen.test.tsx`: the `error-more` markup still contains the first page's titles. e2e: the first-page row titles remain visible next to the alert.
  - |
    AC13, return to Orders after sign-in. In `orders.test.ts`: `expect(ordersSignInHref()).toContain("next=%2Forders")` pins the hand-off value. Full sign-in return cannot be asserted here because the sign-in screen does not exist in this repo yet (see open questions). Plus a nav regression in `shell.test.ts`: `expect(MAIN_NAV.map((e) => e.key)).toEqual(["home", "orders"]); expect(isCurrent(MAIN_NAV[1], "/orders")).toBe(true);` and an updated TopBar case that `/` marks only Home as current.
assumptions_or_open_questions:
  - |
    Records API has no orders endpoint, no session endpoint and no database wiring today (services/api/src has only AppController and an empty RecordsController). I assume a separate API item delivers `GET /orders?tab=active|past&limit=N&cursor=...` returning `{ items: [{ id, number, title, status, placedAt }], nextCursor, hasAnyOrders }`, scoped to the signed-in customer, newest first, filtered by tab server-side. This plan only builds the web client against that contract and a mock. Please confirm the contract or point to the item that owns it.
  - |
    Deferred question: paging style and page size. I chose automatic load-on-scroll (IntersectionObserver sentinel) with a spinner row, because the prototype shows a spinner and an error row but no "Load more" button, and page size 20 (`ORDERS_PAGE_SIZE`). The prototype's fixture uses 5 for demo only. Say if you want a "Load more" button or a different size.
  - |
    Open project-wide questions (expected orders per customer at scale; retention and backup of order records) are not answerable from the code. ADR-0006 sizes the system at about 500 users, so cursor paging at 20 per page is ample. Retention and backup are API and database concerns and do not change this web-only plan.
  - |
    AC 13 depends on the sign-in screen (stubbed in the prototype, owned by another item; `/sign-in` is only an href in lib/shell.ts today). I pass `?next=%2Forders` and assume the sign-in item honours same-origin relative `next` values. If sign-in will use a different return mechanism, `ordersSignInHref` is the single place to change.
  - |
    "Browse the menu" links to `/menu`. No Menu route exists in apps/web yet (the prototype's Menu is a stub owned by another item); until it ships the link 404s. AC 7 is asserted as navigation to `/menu`.
  - |
    Prototype vs guidelines: the prototype's shell nav shows only Home, while the UI guidelines say to append new sections to the end of the nav. I follow the guidelines and add Orders. The prototype also wraps content in a grey `.page` card that exists only for the stub screens; I omit it because the shell already centres content at `--size-shell-max`.
  - |
    Status vocabulary (Received, Preparing, Ready for pickup, Fulfilled, Cancelled) comes only from the prototype fixtures. The item says Active means "not yet fulfilled" and Past means "fulfilled or cancelled"; an unknown future status falls into Active via `tabOf`. Status progression itself is out of scope.
  - |
    Order dates are rendered in the viewer's locale via `Intl` (prototype uses en-GB, "28 Oct, 12:40"). Whether the product needs a fixed locale or timezone is unspecified.
  - |
    Unit tests run in vitest `environment: "node"` with `renderToStaticMarkup` (no jsdom or testing-library in apps/web/package.json), so interactive behaviour (IntersectionObserver, tab keyboard handling, Retry click) is covered by Playwright rather than by adding new test dependencies.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  None — read-only UI over an assumed API contract. No schema, migration, stored data, seed or new env var (reuses `RECORDS_API_URL`, already read by `next.config.ts` and `lib/session.ts`). Order and rollback: ship the web change after the API endpoint exists; until then `/orders` shows the first-page error row. Rollback is reverting the web change, which only removes the nav entry and route.

  ### Design source

  Read from the approved prototype `PROD-28OCT-STORY-048-design.html`: screens "Orders" (h1 "Your orders", `.tabs` with Active/Past, `.order-list` of `.card.order-row`, `.badge-*` with icon + word, `.skeleton` x3, `.state-row` with `.spinner`, `.alert.alert-danger` with `.btn-secondary.btn-sm` Retry), "No orders" (`.empty-state` with bag icon, h2, p, one `.btn-primary` "Browse the menu"), "Sign in" and "Menu" (stubs owned by other items, not built here). Token loading today: `apps/web/src/app/globals.css:2` imports `design-system/tokens.css`, and `apps/web/src/app/layout.tsx:5` imports `globals.css`.

  ### Shape

  ```mermaid
  flowchart TD
    Layout[app/layout.tsx] --> TopBarControls[TopBarControls]
    TopBarControls --> TopBar[TopBar]
    TopBar --> Shell[lib/shell.ts MAIN_NAV]
    Layout --> OrdersPage[app/orders/page.tsx]
    OrdersPage --> Session[lib/session.ts getSession]
    OrdersPage --> OrdersScreen[components/orders/OrdersScreen]
    OrdersScreen --> OrdersLib[lib/orders.ts]
    OrdersScreen --> Row[OrderRow and OrderStatusBadge]
    OrdersScreen --> NoOrders[NoOrders]
    OrdersLib --> NextCfg[next.config.ts rewrite /api/orders]
    NextCfg --> Mock[e2e mock-session-server.mjs]
    classDef touched fill:#f96,color:#000
    class Shell,OrdersPage,OrdersScreen,OrdersLib,Row,NoOrders,NextCfg,Mock touched
  ```

  Touched nodes: Shell (append Orders nav entry), OrdersPage (new, session gate), OrdersScreen/Row/NoOrders (new UI), OrdersLib (new logic and fetch seam), NextCfg (route the browser's orders calls to the API), Mock (e2e fixture). Layout, TopBar, TopBarControls and Session are existing and unchanged.
review_focus: |
  IN: the web-only `/orders` page, its logic/UI components, styles, nav entry, rewrite and e2e fixture. OUT: the Records API orders endpoint, sign-in screen, Menu screen, order detail and status progression. Riskiest part is the paging state machine (spinner, retry on the same cursor, loaded rows preserved on failure, no duplicate rows) and the signed-out redirect that must never render the list. Deliberate: no new test or runtime dependencies, interactive behaviour is covered by Playwright because unit tests run in node with static markup; the data route is `/api/orders` to avoid colliding with the `/orders` page.
