summary: |
  Add the Order confirmed screen (sketch screen `confirmation`) at `/order-confirmed?order=<number>`: heading "Thanks for your order", the order number, a secondary "Back to Menu" button (sketch id `continue-shopping`) that goes to the Menu, and a primary "View orders" button (`view-orders`) that goes to the existing Orders screen. Signed-out visitors are sent to sign-in; a missing or malformed number (not exactly 6 letters or digits) is sent to Orders instead of rendering a confirmation. "Placed" replaces "Received" as the status of a newly created order across the web app (type, badge, tests, e2e mock), so the Orders list shows a new order as "Placed". Per the reviewer, the sketch wins over AC2's wording, so "Continue shopping" is superseded by "Back to Menu". Order creation, persistence, order-number generation and its uniqueness belong to the order-processing story, not this one.

review_focus: |
  IN: the confirmation screen, its route and guard, the 6-character format check on the `?order=` value, and replacing "Received" with "Placed" in the web type, badge, unit tests and e2e mock. OUT (decided by the reviewer): order-number generation and its uniqueness, the place-order endpoint, the orders table and its UNIQUE constraint, the checkout-to-confirmation navigation, and any ownership or existence check of the order. Riskiest part: the status rename touches the e2e mock server and several tests, so a missed "Received" breaks them. Deliberate: the label is "Back to Menu" (sketch over AC2), `?order=` is display-only, and `MENU_HREF` already exists as "/menu" and is reused.

scope:
  - description: |
      Add the confirmation route href in `shell.ts` (every route href lives there). `MENU_HREF` ("/menu") and `ORDERS_HREF` already exist and are reused. Do NOT add the screen to `MAIN_NAV` (it is not a nav destination).

      ```ts
      export const ORDER_CONFIRMED_HREF = "/order-confirmed";
      /** For the future place-order step to navigate to. */
      export function orderConfirmedHref(orderNumber: string): string {
        return `${ORDER_CONFIRMED_HREF}?order=${encodeURIComponent(orderNumber)}`;
      }
      ```
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      Keeps the one-place-for-hrefs convention; gives the order-processing story a single helper to call. Nothing in this story calls it.
  - description: |
      Order number format rule, and "Placed" replacing "Received", in `orders.ts`:

      ```ts
      export const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9]{6}$/;
      export function isOrderNumber(value: unknown): value is string {
        return typeof value === "string" && ORDER_NUMBER_PATTERN.test(value);
      }
      // before: "Received" | "Preparing" | "Ready for pickup" | "Fulfilled" | "Cancelled"
      export type OrderStatus = "Placed" | "Preparing" | "Ready for pickup" | "Fulfilled" | "Cancelled";
      ```

      `tabOf` already returns "active" for anything not Fulfilled or Cancelled, so "Placed" is Active with no change. In `OrderStatusBadge.tsx` rename the `Received` entry to `Placed: { tone: "badge-info", icon: "info" }` (the Record is exhaustive, so this is required to compile).

      Rename every other "Received" found by search (each of these was read):
      - apps/web/src/lib/orders.test.ts line 16 (`status: "Received"`) and line 25 (the active-statuses list).
      - apps/web/src/components/orders/OrderRow.test.tsx line 24 (the statuses list).
      - apps/web/tests/e2e/orders.spec.ts line 21 (`toContainText("Received")` becomes `"Placed"`).
      - apps/web/tests/e2e/mock-session-server.mjs line 10 (`ACTIVE = ["Placed", "Preparing", "Ready for pickup"]`), so the first row of the mock list is "Placed".

      After the edit, a search for "Received" across apps/web must return nothing.
    files:
      - apps/web/src/lib/orders.ts
      - apps/web/src/lib/orders.test.ts
      - apps/web/src/components/orders/OrderStatusBadge.tsx
      - apps/web/src/components/orders/OrderRow.test.tsx
      - apps/web/tests/e2e/orders.spec.ts
      - apps/web/tests/e2e/mock-session-server.mjs
    rationale: |
      AC4 (format rule) and AC5 (the Orders list shows a new order as "Placed"). The reviewer decided "Placed" is the status of a newly created order and "Received" is not used.
  - description: |
      New client component `OrderConfirmedScreen`, props `{ orderNumber: string }`, using `useRouter` as `BookingScreen` does. Builds sketch screen `confirmation` in the sketch's order: wrapper `div.page.stack.stack-4`; `h1` "Thanks for your order" (`confirmation-title`); a block with the label "Order number" and the number in a `strong` with `data-testid="order-number"` (`order-number`; the block has `role="status"` so it is announced politely); `div.actions` (`confirmation-actions`) holding `button.btn.btn-secondary` "Back to Menu" (`router.push(MENU_HREF)`, flow `to-menu-after-order`) then `button.btn.btn-primary` "View orders" (`router.push(ORDERS_HREF)`, flow `to-orders-after-order`). Exactly one primary button, per the UI guidelines.

      The sketch's header (logo only) is the app `TopBar` from the layout and is not re-drawn. The sketch has no `state_of` entries for this screen, so no empty, error or loading state is built.

      Styling uses only existing classes in globals.css and their tokens: `.page` (`--size-modal`), `.stack-4` (`--space-4`), `.actions` (`--space-2`), `.btn-primary` and `.btn-secondary` (`--color-primary`, `--color-bg`, `--color-fg`, `--color-border-strong`), and `.text-muted` (`--color-fg-muted`) on the "Order number" label. No new CSS and no colour or pixel literals.
    files:
      - apps/web/src/components/orders/OrderConfirmedScreen.tsx
      - apps/web/src/components/orders/OrderConfirmedScreen.test.tsx
    rationale: |
      AC1, AC2, AC3. Reuses the BookingScreen button and router pattern and sits beside OrdersScreen; no catalogue component covers a confirmation, so this is the one new component.
  - description: |
      New server page, same shape as `app/orders/page.tsx` and `app/appointments/page.tsx`:

      ```tsx
      export default async function OrderConfirmedPage({
        searchParams,
      }: {
        searchParams: Promise<{ order?: string }>;
      }) {
        if ((await getSession()) === null) redirect(ordersSignInHref());
        const { order } = await searchParams;
        if (!isOrderNumber(order)) redirect(ORDERS_HREF);
        return <OrderConfirmedScreen orderNumber={order} />;
      }
      ```

      The number is display-only (reviewer-approved): the page does not check that the order exists or belongs to the customer. A signed-out visitor has no order to confirm, so the sign-in `next` reuses the Orders target (`ordersSignInHref()`); no new entry in `NEXT_TARGETS`. A missing or malformed number never renders as a confirmation.
    files:
      - apps/web/src/app/order-confirmed/page.tsx
      - apps/web/src/app/order-confirmed/page.test.tsx
    rationale: |
      Auth gate plus the AC4 guard, following the existing page tests (orders/page.test.tsx mocks `@/lib/session` and `next/navigation`).

tests:
  - |
    AC1 - apps/web/src/components/orders/OrderConfirmedScreen.test.tsx (write first; fails because the component is missing)

    ```tsx
    render(<OrderConfirmedScreen orderNumber="AB12CD" />);
    expect(screen.getByRole("heading", { level: 1, name: "Thanks for your order" })).toBeInTheDocument();
    expect(screen.getByTestId("order-number")).toHaveTextContent("AB12CD");
    ```
  - |
    AC2 (wording updated to the approved sketch text "Back to Menu"; "Continue shopping" is superseded) - same file; mock `next/navigation` `useRouter` as BookingScreen.test.tsx does

    ```tsx
    await user.click(screen.getByRole("button", { name: "Back to Menu" }));
    expect(push).toHaveBeenCalledWith(MENU_HREF);
    expect(screen.queryByRole("button", { name: /continue shopping/i })).toBeNull();
    ```
  - |
    AC3 - same file

    ```tsx
    await user.click(screen.getByRole("button", { name: "View orders" }));
    expect(push).toHaveBeenCalledWith("/orders");
    expect(container.querySelectorAll(".btn-primary")).toHaveLength(1);
    ```
  - |
    AC4 - apps/web/src/lib/orders.test.ts and apps/web/src/app/order-confirmed/page.test.tsx

    ```ts
    expect(isOrderNumber("AB12CD")).toBe(true);
    expect(isOrderNumber("ab12cd")).toBe(true);
    expect(isOrderNumber("AB12C")).toBe(false);
    expect(isOrderNumber("AB12CD7")).toBe(false);
    expect(isOrderNumber("AB-2CD")).toBe(false);
    expect(isOrderNumber(undefined)).toBe(false);

    // page
    getSession.mockResolvedValue(null);
    await expect(OrderConfirmedPage({ searchParams: Promise.resolve({ order: "AB12CD" }) })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/sign-in?next=%2Forders");
    getSession.mockResolvedValue({ role: "customer" });
    await expect(OrderConfirmedPage({ searchParams: Promise.resolve({ order: "bad" }) })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenLastCalledWith("/orders");
    const el = await OrderConfirmedPage({ searchParams: Promise.resolve({ order: "AB12CD" }) });
    expect(el.type).toBe(OrderConfirmedScreen);
    ```
  - |
    AC5 - apps/web/src/components/orders/OrdersScreen.test.tsx (new case) plus the renamed e2e check. The screen test passes a fake `fetchPage` returning one "Placed" order (Active tab).

    ```tsx
    render(
      <OrdersScreen
        fetchPage={async () => ({
          items: [{ id: "1", number: "AB12CD", title: "Order", status: "Placed", placedAt: "2026-11-03T10:00:00Z" }],
          nextCursor: null,
          hasAnyOrders: true,
        })}
      />,
    );
    const row = await screen.findByText(/AB12CD/);
    expect(within(row.closest("li")!).getByText("Placed")).toBeInTheDocument();
    expect(tabOf("Placed")).toBe("active");
    ```

    e2e (apps/web/tests/e2e/orders.spec.ts, after the mock rename):

    ```ts
    await expect(rows.first()).toContainText("Placed");
    ```
  - |
    Rename check - the existing orders tests still pass with "Placed" in place of "Received", and no "Received" remains:

    ```sh
    grep -rn "Received" apps/web/src apps/web/tests   # expect no output
    ```
  - |
    Narrow run commands (derived from the project command). The e2e spec is run with the project's Playwright setup in apps/web.

    ```sh
    (cd apps/web && pnpm test -- src/components/orders src/lib/orders.test.ts src/lib/shell.test.ts src/app/order-confirmed/page.test.tsx)
    ```

assumptions_or_open_questions:
  - |
    Decided by the reviewer: the button label is "Back to Menu", the sketch overrides AC2's "Continue shopping" (superseded), and AC2's test is written against the approved text. Note the sketch itself spells it "Back to menu"; the plan uses the reviewer's capitalisation. The UI guidelines ask for sentence case, so this is a deliberate exception.
  - |
    Decided by the reviewer: "Placed" is the status of a newly created order and "Received" is not used, so the status is renamed rather than added alongside. The future GET /orders API must return "Placed".
  - |
    Decided by the reviewer: order creation, the orders table, the UNIQUE constraint, checkout completion and the navigation from /checkout, and order-number generation all belong to the order-processing story. The API order-number generator from the earlier draft is therefore removed from this plan. The two deferred "how is the number generated and kept unique" questions are handed to that story. Nothing in this story navigates to `/order-confirmed` yet.
  - |
    Decided by the reviewer: `?order=` is display-only. The page checks only the 6-letter-or-digit format, not ownership or existence; that comes with the backend order service.
  - |
    Decided by the reviewer: retention, archival, backup and compliance questions are project-level and do not affect this screen.
  - |
    Checked: `MENU_HREF` is already "/menu" in apps/web/src/lib/shell.ts, a Menu page exists at apps/web/src/app/menu/page.tsx, and Menu is in `MAIN_NAV`. apps/web/src/components/orders/NoOrders.tsx keeps its own duplicate `MENU_HREF`; it is left as is, out of scope.
  - |
    The order number has no dedicated display style (for example large or monospace) in the tokens or classes. The plan uses `strong` and existing classes with no new CSS; a distinct style would need a token decision.

estimated_points: 3

package_dependencies: []

notes: |
  ### Data & rollout
  None - no schema, migration, stored-data change, seed, or setting. The status rename is a web-side type and test-fixture change; the e2e mock server (`apps/web/tests/e2e/mock-session-server.mjs`) is a test fixture, not stored data.

  Token loading: `apps/web/src/app/globals.css` line 2 imports `../../../../design-system/tokens.css` (after `@import "tailwindcss"` on line 1). The classes used here (`.page`, `.stack-4`, `.actions`, `.btn-*`, `.text-muted`) already read those tokens in globals.css, so this item adds no styles.

  Sketch coverage: screen `confirmation` is built by `OrderConfirmedScreen` (confirmation-title, order-number, confirmation-actions); flow `to-menu-after-order` by the Back to Menu button; flow `to-orders-after-order` by View orders. The sketch's `menu` screen and its header (nav, cart control) belong to other stories. The sketch has no `state_of` entries for this screen, so no empty, error or loading state is planned.

  Content handling: the work item and the deferred-questions block were treated as data. None contained instructions outside the change itself.

  ```mermaid
  flowchart TD
    layout[app/layout.tsx and TopBar] --> page[app/order-confirmed/page.tsx]
    page --> session[lib/session.ts getSession]
    page --> screen[OrderConfirmedScreen]
    page --> orders[lib/orders.ts isOrderNumber]
    screen --> shell[lib/shell.ts MENU_HREF and ORDERS_HREF]
    shell --> menuPage[app/menu/page.tsx]
    shell --> ordersPage[app/orders/page.tsx]
    ordersPage --> ordersScreen[OrdersScreen]
    ordersScreen --> badge[OrderStatusBadge]
    badge --> orders
    mock[e2e mock-session-server.mjs] --> ordersScreen
    classDef touched fill:#f96,color:#000
    class page,screen,orders,shell,badge,mock touched
  ```
  Touched: page (new route and auth gate), screen (new UI), orders.ts (format guard and the Placed rename), shell.ts (confirmation href), badge (Placed), mock (e2e fixture status rename).
