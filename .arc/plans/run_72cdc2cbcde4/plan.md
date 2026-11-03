summary: |
  Build the Checkout screen and its failed-order state for a signed-in customer, and the Records API endpoint that creates the order. The web side fills in the existing `/checkout` page (today only an `h1` behind a guest redirect) with a Delivery/Collection choice, name, phone, address (delivery only), an order summary read from the existing `CartProvider`, and one primary "Place order" button. Validation runs only when Place order is pressed. A failed submit shows an "order not placed" alert and keeps every entered value and the cart, so pressing Place order again can succeed. The API adds `POST /orders` behind `SessionGuard` (a guest creates nothing; the order always belongs to the session's player), a new `orders` table with a sequence-generated short order number, and a per-customer idempotency key so one submission never creates two orders. On success the cart is cleared and the customer is sent to `/order-confirmed`, a route the Order confirmed story owns (this story only navigates into it). An address is complete when it has street, city and an Indian 6-digit PIN code. Editing anything after a failed attempt mints a new idempotency key; an unchanged retry reuses the old one.
scope:
  - description: |
      Migration `004_orders.sql`: new `orders` table, sequence and indexes, all with `if not exists` like 003.
      Columns: `id uuid primary key default gen_random_uuid()`, `player_id uuid not null references players (id)`, `number integer not null default nextval('orders_number_seq')` (sequence `orders_number_seq` starts at 1001), `fulfilment text not null check (fulfilment in ('delivery','collection'))`, `name text not null`, `phone text not null`, `address text` with a check that delivery has one and collection has none, `lines jsonb not null` (snapshot of the cart lines), `idempotency_key text not null`, `created_at timestamptz not null default now()`.
      Unique index `orders_number_uniq (number)` and unique index `orders_player_idem_uniq (player_id, idempotency_key)`. Add a header comment naming the rules that must stay in sync with `orders.validation.ts`.
    files:
      - services/api/migrations/004_orders.sql
    rationale: |
      Answers both deferred questions in the database. A sequence never hands out one number twice, even under concurrent requests, and the unique index backs it up. The (player, key) unique index makes a repeated submission land on the existing order.
  - description: |
      Orders API mirroring `AppointmentsModule`: `OrdersController` (`@Controller('orders')`, `@UseGuards(SessionGuard)`, `POST /orders`), `OrdersService.place`, `OrdersModule`, and shared rules in `orders.validation.ts`. The player id comes from `req.player.id` only, never from the body. Wire `OrdersModule` into the `imports` array of `app.module.ts`.

      ```ts
      export type OrderLineInput = { id: string; name: string; unitPrice: number; quantity: number };
      export type PlaceOrderInput = {
        fulfilment: 'delivery' | 'collection';
        name: string; phone: string; address?: string;
        lines: OrderLineInput[];
        idempotencyKey: string;
      };
      export type PlaceOrderResult =
        | { ok: true; order: { id: string; number: string }; replayed: boolean }
        | { ok: false; code: 'invalid' | 'empty_cart' };
      async place(playerId: string, input: PlaceOrderInput): Promise<PlaceOrderResult>
      ```

      Rules: name non-blank after trim; phone has 10 to 15 digits once spaces, hyphens, dots, brackets and a leading + are ignored; delivery needs an address that passes `addressError` (three or more comma-separated parts, and the last part is exactly 6 digits, an Indian PIN code such as 110001 or 560103); collection stores `address = null`; at least one line, each with a non-blank id and name, a finite `unitPrice >= 0` and an integer `quantity >= 1`; a non-blank idempotency key. The insert uses `on conflict (player_id, idempotency_key) do nothing returning id, number`; when no row comes back it selects the existing order by (player_id, key) and returns it with `replayed: true`. The controller type-checks the body like `AppointmentsController.book` (the `isText` style), maps `invalid` and `empty_cart` to 400, and returns 201 `{ order: { id, number } }`, or 200 for a replay.
    files:
      - services/api/src/orders/orders.validation.ts
      - services/api/src/orders/orders.validation.spec.ts
      - services/api/src/orders/orders.service.ts
      - services/api/src/orders/orders.service.spec.ts
      - services/api/src/orders/orders.controller.ts
      - services/api/src/orders/orders.controller.spec.ts
      - services/api/src/orders/orders.module.ts
      - services/api/src/app.module.ts
    rationale: |
      The ACs say "no order is created" for bad input (AC4-6, 16-18) and for guests (AC11); a client check alone cannot guarantee that, so the API refuses them too. Pool access goes through `DatabaseService` as `AppointmentsService` does.
  - description: |
      Web lib `checkout.ts`: types, validation and the client call, same shape as `lib/appointments.ts`. `validateCheckout(form)` returns `{ name?, phone?, address? }` with messages as the UI guidelines ask (what went wrong and how to fix it): "Enter your name", "Enter a phone number with 10 to 15 digits", "Enter your address", "Enter an address with street, city and a 6-digit PIN code" (the PIN rule is `^\d{6}$` on the last comma-separated part, trimmed). `placeOrder` POSTs JSON to `/api/orders` with `credentials: "include"` and never throws: any non-2xx or network error is `{ ok: false }`. Add a keep-in-sync comment pointing at `orders.validation.ts`. `newIdempotencyKey()` wraps `crypto.randomUUID()`. The body maps each `CartLine` to `{ id, name, unitPrice, quantity }` (the `image` is not sent).

      ```ts
      export type Fulfilment = "delivery" | "collection";
      export type CheckoutForm = { fulfilment: Fulfilment; name: string; phone: string; address: string };
      export type CheckoutErrors = Partial<Record<"name" | "phone" | "address", string>>;
      export function validateCheckout(form: CheckoutForm): CheckoutErrors;
      export function placeOrder(input: PlaceOrderBody): Promise<{ ok: true; number: string } | { ok: false }>;
      ```
    files:
      - apps/web/src/lib/checkout.ts
      - apps/web/src/lib/checkout.test.ts
    rationale: |
      Pure validation tested in isolation, and a client fetch that returns a result instead of throwing, as `bookAppointment` does. `/api/orders` is already rewritten to the API in `apps/web/next.config.ts` (line 11), and a Next rewrite matches every method, so POST needs no config change (verified by the e2e test).
  - description: |
      Reuse the existing cart; add no new cart store. `CartProvider` already keeps the cart in localStorage under `CART_STORAGE_KEY` and is mounted in `app/layout.tsx`, so the guest cart survives sign-in (the settled project decision). Extend its context value with two members and nothing else:
      `clear: () => void` (sets the cart to `[]`, which the existing persist effect writes to storage) and `hydrated: boolean` (the provider already tracks it). Checkout needs `hydrated` because the first render is always an empty cart, and without it a signed-in customer with a full cart would flash the empty state. Existing helpers `cartTotal`, `formatMoney` and the `CartLine` type from `lib/cart.ts` are reused as they are; `lib/cart.ts` and `lib/cartStorage.ts` are not changed.
    files:
      - apps/web/src/components/cart/CartProvider.tsx
      - apps/web/src/components/cart/CartProvider.test.tsx
    rationale: |
      The cart story (#37, commit 9e1bfa2) already shipped `CartProvider`, `useCart`, `cartTotal` and `formatMoney`. The checkout needs only to clear the cart after success and to know when storage has been read. There is no `CartProvider.test.tsx` yet, so it is created here for `clear` and `hydrated`.
  - description: |
      `CheckoutScreen` client component for the sketch's `checkout` screen and its `checkout-error` state (one component, a `failed` flag), plus `OrderSummary`. Replace the placeholder body of `app/checkout/page.tsx` with `<CheckoutScreen />` after the existing guest redirect (keep `redirect(`${SIGN_IN_HREF}?next=checkout`)`; `shell.ts` already has `CHECKOUT_HREF` and the `checkout` sign-in target, so it needs no change).

      Renders inside `div.page.stack.stack-4` (as `BookingScreen` does): `h1` "Checkout"; the failed alert (below); a `fieldset.radio-group` with legend "How do you want your order" and radios Delivery (default, the sketch's `current`) and Collection; Name `.field`; Phone number `.field`; Address `.field` only while Delivery is chosen; `OrderSummary`; `.actions` holding one `.btn.btn-primary` "Place order".

      `OrderSummary` is a `ul.cart-lines` with `aria-label="Order summary"`; each line shows name, "quantity × price" in `.cart-line-meta`, and line total via `formatMoney`; below it a `.cart-total-row` with "Total" and `formatMoney(cartTotal(cart))`. It reuses the `CartLine` styling classes already in `globals.css` and does not render the `CartLine` component, because that one carries steppers and Remove.

      Behaviour:
      - Errors appear only after Place order is pressed (a `submitted` flag), so an empty address with no press shows nothing (AC7). Each field uses `.input`, `.is-invalid`, `aria-invalid`, `aria-describedby` and a `.field-error` paragraph (colour is never the only signal). Focus moves to the first invalid field.
      - Invalid form: `placeOrder` is not called (AC4-6, 16-18).
      - Valid form: `pending` true, button disabled and labelled "Placing order…" (AC20), then `placeOrder` is called. The idempotency key is held in a `useRef` together with the signature of the last attempted payload (fulfilment, name, phone, address when Delivery, and the cart lines with quantities). Before each submit the screen compares the current signature with the stored one: unchanged means reuse the key (a retry after a lost response cannot double-create); any change to contact details, fulfilment, address or cart contents mints a new key via `newIdempotencyKey()`. A `pending` guard stops a second click.
      - Success: `clear()`, then `router.push(`${ORDER_CONFIRMED_HREF}?number=<n>`)` where `ORDER_CONFIRMED_HREF = "/order-confirmed"` (AC9). The route and page belong to the Order confirmed story. A `placed` flag keeps the summary rendered so clearing the cart does not flash the empty state before navigation.
      - Failure: `pending` false and an `.alert.alert-danger` with `role="alert"`, `tabIndex={-1}` and the `Icon` from `components/orders/Icon.tsx`, titled "Your order was not placed", text "Something went wrong on our side. Your details and cart are still here. Try again.", focused when it appears. Form values, fulfilment, address and cart are untouched (AC13, AC14); Place order is enabled again and the next press resubmits (AC15).
      - Empty cart once `hydrated`: the existing `.empty-state` pattern with one action ("Back to menu", linking to `MENU_HREF`) instead of the form. No AC covers this; it prevents an empty order (the API also rejects it).

      Sketch conflicts, decided explicitly: the sketch's error screen shows an address-specific "We cannot deliver to this address" and a disabled Place order, but AC12-15 and AC20 and the scope line "generic failed-order recovery" specify a generic failure with Place order usable again. This plan follows the ACs: no delivery-area error, and the disabled button is the in-flight state only. The sketch has no phone field and shows its failure as a toast; the phone field is added because AC5, 16 and 17 require it, and the failure is a persistent `.alert` because the UI guidelines reserve `.toast` for transient confirmations and this message must stay until the customer retries. The sketch's header (logo, nav, cart control) is the existing `TopBar` and `MenuCart` from the layout and is not redrawn.
    files:
      - apps/web/src/components/checkout/CheckoutScreen.tsx
      - apps/web/src/components/checkout/CheckoutScreen.test.tsx
      - apps/web/src/components/checkout/OrderSummary.tsx
      - apps/web/src/components/checkout/OrderSummary.test.tsx
      - apps/web/src/app/checkout/page.tsx
      - apps/web/src/app/checkout/page.test.tsx
    rationale: |
      Extends the `BookingScreen` pattern (pending flag, focused `.alert`, `.field`/`.field-error`, `.actions`). Uses only existing classes: `.page`, `.stack`, `.stack-4`, `.field`, `.field-hint`, `.field-error`, `.input`, `.is-invalid`, `.alert`, `.alert-danger`, `.actions`, `.btn`, `.btn-primary`, `.btn-secondary`, `.empty-state`, `.cart-lines`, `.cart-line`, `.cart-line-name`, `.cart-line-meta`, `.cart-total-row`. One primary button per view, sentence case, verb-first labels, per the UI guidelines. The page test already covers the guest redirect and is extended for the signed-in render.
  - description: |
      Navigation into Order confirmed only. Add `ORDER_CONFIRMED_HREF = "/order-confirmed"` to `shell.ts` so the screen and tests share one constant. This story builds no confirmation page: the Order confirmed story owns the `/order-confirmed` route and renders the order reference it is given. Until that story lands the route has no page, so this story's tests assert the navigation call (`push`) and the Playwright test asserts the URL, not the page content.
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      Confirmed by the reviewer: Checkout owns navigation into the route, Order confirmed owns the page. The `number` query parameter name is an assumption the Order confirmed story must match (see open questions).
  - description: |
      Styling in `globals.css`, tokens only: `.radio-group` (fieldset reset; `display: flex; flex-direction: column; gap: var(--space-2)`; a row at the 768px tablet breakpoint written the same way as the file's existing media query), `.radio-option` (`display: flex; align-items: center; gap: var(--space-2); min-height: var(--size-control)`; the native radio sized with `var(--size-check)`; `:focus-within` ring using `var(--border-width-strong) solid var(--color-focus)` and `var(--size-focus-offset)`, as `.input:focus-visible` does). No colour literals and no raw pixel values. Tokens are loaded by `@import "../../../../design-system/tokens.css"` at `apps/web/src/app/globals.css:2`. Confirm each token name exists in `design-system/tokens.css` before use (`--color-focus`, `--size-control` and `--size-check` were confirmed there); anything uncovered goes to the open questions, not into a literal.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      No radio class exists yet (searched `globals.css`). The summary and field styles needed already exist from the cart and booking work, so only the radio group is new.
  - description: |
      e2e (Playwright, existing mock API). Extend `mock-session-server.mjs` with `POST /orders`: 401 without `e2e-session=1`; 500 when cookie `e2e-order=fail-once` is present and no order has been accepted yet in this server run; 400 for an empty `lines`; otherwise 201 `{ order: { id, number: "1001" } }`, and a repeated `idempotencyKey` returns 200 with the same number. New `checkout.spec.ts` seeds the cart in `localStorage` under key `cart` and covers: the address field showing only for Delivery, validation messages after Place order, failure then retry navigating to `/order-confirmed?number=1001` (URL assertion only) with values and cart kept after the failure, a changed field after failure sending a different `idempotencyKey` (the mock records the keys it receives), and the disabled button while a slow response is pending (a `e2e-order=slow` cookie delays the response).
    files:
      - apps/web/tests/e2e/mock-session-server.mjs
      - apps/web/tests/e2e/checkout.spec.ts
    rationale: |
      Matches how `orders.spec.ts` exercises the API through the mock, and covers the failure then retry journey (AC12-15) in a real browser, which unit tests only approximate.
tests:
  - |
    AC1 (CheckoutScreen.test.tsx, written first and failing because the component does not exist). Render inside `CartProvider` with the cart seeded in `localStorage` under `CART_STORAGE_KEY`.
    ```tsx
    seedCart([{ id: "p1", name: "Pizza", unitPrice: 900, quantity: 2, image: "/p1.jpg" }]);
    render(<CartProvider><CheckoutScreen /></CartProvider>);
    expect(await screen.findByRole("radio", { name: "Delivery" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Collection" })).toBeInTheDocument();
    ```
  - |
    AC2 and AC3 (CheckoutScreen.test.tsx).
    ```tsx
    await user.click(screen.getByRole("radio", { name: "Delivery" }));
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Collection" }));
    expect(screen.queryByLabelText("Address")).not.toBeInTheDocument();
    ```
  - |
    AC4 and AC5 (CheckoutScreen.test.tsx; `placeOrder` mocked with `vi.mock("@/lib/checkout")` keeping the real `validateCheckout`).
    ```tsx
    await user.click(screen.getByRole("radio", { name: "Collection" }));
    await user.type(screen.getByLabelText("Phone number"), "0123456789");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    expect(placeOrder).not.toHaveBeenCalled();
    expect(screen.getByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    // mirror case: name typed, phone empty -> screen.getByText(/Enter a phone number/)
    ```
  - |
    AC6 and AC18 (checkout.test.ts and CheckoutScreen.test.tsx).
    ```ts
    const base = { fulfilment: "delivery", name: "Ana", phone: "0123456789" } as const;
    expect(validateCheckout({ ...base, address: "" }).address).toBe("Enter your address");
    expect(validateCheckout({ ...base, address: "12 MG Road, Bengaluru" }).address).toMatch(/street, city and a 6-digit PIN code/);
    expect(validateCheckout({ ...base, address: "12 MG Road, Bengaluru, 5601" }).address).toBeDefined();   // 4 digits
    expect(validateCheckout({ ...base, address: "12 MG Road, Bengaluru, 56010A" }).address).toBeDefined(); // not numeric
    expect(validateCheckout({ ...base, address: "12 MG Road, Bengaluru, 5601033" }).address).toBeDefined(); // 7 digits
    expect(validateCheckout({ ...base, address: "12 MG Road, Bengaluru, 560103" }).address).toBeUndefined();
    ```
    The component test asserts `placeOrder` is not called and the address field shows the error. The API twin lives in orders.validation.spec.ts and orders.service.spec.ts (`place` returns `{ ok: false, code: 'invalid' }` and no insert query runs).
  - |
    AC7 (CheckoutScreen.test.tsx). No error before the button is pressed.
    ```tsx
    await user.click(screen.getByRole("radio", { name: "Delivery" }));
    await user.click(screen.getByLabelText("Name"));
    await user.tab();
    expect(screen.queryByText("Enter your address")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Address")).not.toHaveAttribute("aria-invalid");
    ```
  - |
    AC8 (orders.service.spec.ts, orders.controller.spec.ts and CheckoutScreen.test.tsx). The service inserts with the session's player id; the controller ignores a `playerId` in the body.
    ```ts
    const res = await service.place("player-1", { ...collection, name: "Ana", phone: "0123456789" });
    expect(res.ok).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("insert into orders"), expect.arrayContaining(["player-1"]));

    await controller.place({ player: { id: "player-1" } } as PlayerRequest, { ...body, playerId: "someone-else" } as never);
    expect(service.place).toHaveBeenCalledWith("player-1", expect.any(Object));
    ```
    The screen test asserts a valid Collection form calls `placeOrder` once with `fulfilment: "collection"` and the seeded lines.
  - |
    AC9 (CheckoutScreen.test.tsx and confirmed/page.test.tsx). Success clears the cart and navigates.
    ```tsx
    placeOrder.mockResolvedValue({ ok: true, number: "1001" });
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/order-confirmed?number=1001"));
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe("[]");
    ```
    The Order confirmed page itself is the other story's; this story asserts only the navigation.
  - |
    AC10 (OrderSummary.test.tsx and CheckoutScreen.test.tsx).
    ```tsx
    render(<OrderSummary cart={[{ id: "p1", name: "Pizza", unitPrice: 900, quantity: 2, image: "/p1.jpg" }]} />);
    expect(screen.getByRole("list", { name: "Order summary" })).toBeInTheDocument();
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText(formatMoney(1800))).toBeInTheDocument();
    ```
  - |
    AC11 (orders.controller.spec.ts, checkout/page.test.tsx, e2e). A guest creates nothing.
    ```ts
    sessions.resolve.mockResolvedValue(null);
    await expect(guard.canActivate(ctxWithoutCookie)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.place).not.toHaveBeenCalled();
    ```
    The controller spec also asserts `Reflect.getMetadata('__guards__', OrdersController)` contains `SessionGuard`, as the appointments controller spec does. Page test: `getSession` returns null, so `redirect` throws `redirect:/sign-in?next=checkout`. e2e: `POST /api/orders` without the session cookie returns 401.
  - |
    AC12 (CheckoutScreen.test.tsx).
    ```tsx
    placeOrder.mockResolvedValue({ ok: false });
    await user.click(screen.getByRole("button", { name: "Place order" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your order was not placed");
    expect(push).not.toHaveBeenCalled();
    ```
  - |
    AC13 (CheckoutScreen.test.tsx). After the failure nothing the customer typed is lost.
    ```tsx
    expect(screen.getByRole("radio", { name: "Delivery" })).toBeChecked();
    expect(screen.getByLabelText("Name")).toHaveValue("Ana");
    expect(screen.getByLabelText("Phone number")).toHaveValue("0123456789");
    expect(screen.getByLabelText("Address")).toHaveValue("12 MG Road, Bengaluru, 560103");
    ```
  - |
    AC14 (CheckoutScreen.test.tsx). The cart and summary are unchanged after a failure.
    ```tsx
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual(seeded);
    expect(within(screen.getByRole("list", { name: "Order summary" })).getAllByRole("listitem")).toHaveLength(seeded.length);
    ```
  - |
    AC15 (CheckoutScreen.test.tsx and e2e checkout.spec.ts). The retry reuses the same idempotency key and succeeds.
    ```tsx
    placeOrder.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, number: "1001" });
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/order-confirmed?number=1001"));
    const keys = placeOrder.mock.calls.map(([body]) => body.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    ```
  - |
    Idempotency key per change (CheckoutScreen.test.tsx). An unchanged retry reuses the key; a changed field or cart creates a new one.
    ```tsx
    placeOrder.mockResolvedValue({ ok: false });
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await screen.findByRole("alert");
    await user.type(screen.getByLabelText("Name"), "a");          // any edit after the failure
    await user.click(screen.getByRole("button", { name: "Place order" }));
    const [first, second] = placeOrder.mock.calls.map(([body]) => body.idempotencyKey);
    expect(second).not.toBe(first);
    // repeat for phone, address, fulfilment switch, and a cart quantity change; each mints a new key
    ```
    Also in `checkout.test.ts`: `newIdempotencyKey()` returns a different string on each call.
  - |
    AC16 and AC17 (checkout.test.ts, orders.validation.spec.ts and CheckoutScreen.test.tsx). Phone boundaries in both the web and the API validator.
    ```ts
    const f = { fulfilment: "collection", name: "Ana", address: "" } as const;
    expect(validateCheckout({ ...f, phone: "123456789" }).phone).toBeDefined();         // 9 digits
    expect(validateCheckout({ ...f, phone: "0123456789" }).phone).toBeUndefined();      // 10 digits
    expect(validateCheckout({ ...f, phone: "123456789012345" }).phone).toBeUndefined(); // 15 digits
    expect(validateCheckout({ ...f, phone: "1234567890123456" }).phone).toBeDefined();  // 16 digits
    ```
    The component test asserts `placeOrder` is not called and the phone field shows the error.
  - |
    AC19 (orders.service.spec.ts and CheckoutScreen.test.tsx). A complete Delivery order is stored with the address and the session's customer.
    ```ts
    const res = await service.place("player-1", { ...delivery, address: "12 MG Road, Bengaluru, 560103" });
    expect(res.ok).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("insert into orders"),
      expect.arrayContaining(["player-1", "delivery", "12 MG Road, Bengaluru, 560103"]),
    );
    ```
  - |
    AC20 (CheckoutScreen.test.tsx and e2e). While the request is pending the button is disabled and a second click sends nothing.
    ```tsx
    let release!: (v: { ok: false }) => void;
    placeOrder.mockReturnValue(new Promise((r) => (release = r)));
    await user.click(screen.getByRole("button", { name: "Place order" }));
    const btn = screen.getByRole("button", { name: /Placing order/ });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(placeOrder).toHaveBeenCalledTimes(1);
    ```
  - |
    Deferred question 1, duplicate orders (orders.service.spec.ts). The same (player, key) twice yields one order.
    ```ts
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // insert ... on conflict do nothing
      .mockResolvedValueOnce({ rows: [{ id: "o1", number: 1001 }] }); // select existing
    const res = await service.place("player-1", input);
    expect(res).toMatchObject({ ok: true, replayed: true, order: { id: "o1", number: "1001" } });
    ```
  - |
    Deferred question 2, order number (migration pin in orders.service.spec.ts, as appointments.service.spec.ts pins 003). Read `004_orders.sql` and assert it declares the sequence and both unique indexes.
    ```ts
    const sql = readFileSync(join(__dirname, "../../migrations/004_orders.sql"), "utf8");
    expect(sql).toMatch(/create sequence if not exists orders_number_seq\s+start (with )?1001/i);
    expect(sql).toMatch(/orders_number_uniq/);
    expect(sql).toMatch(/orders_player_idem_uniq/);
    ```
  - |
    Cart reuse (CartProvider.test.tsx). `clear` empties the cart and storage, and `hydrated` turns true after storage is read.
    ```tsx
    act(() => result.current.clear());
    expect(result.current.cart).toEqual([]);
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe("[]");
    expect(result.current.hydrated).toBe(true);
    ```
    Existing `cartStorage.test.ts` and `shell.test.ts` already pin the corrupt-storage fallback and the `checkout` sign-in target, so they are not repeated.
assumptions_or_open_questions:
  - |
    Correction to the earlier draft: it said no cart code exists. It does. Commit 9e1bfa2 (STORY-050) added `lib/cart.ts`, `lib/cartStorage.ts` and `components/cart/CartProvider.tsx`, and `app/checkout/page.tsx` and `CHECKOUT_HREF` already exist. This plan reuses them. The cart line shape is `{ id, name, unitPrice, quantity, image }`, with `unitPrice` a number in rupees (shown with `formatMoney`, INR); the order stores `unitPrice` as sent, not in minor units.
  - |
    Settled by the reviewer: the Order confirmed story owns the order-confirmed route and page, and Checkout only navigates into it. The route is written as `/order-confirmed` with the order number in a `number` query parameter. Still to confirm with that story: the exact parameter name, since the reviewer said only "the order reference passed to it". Until that page exists, `/order-confirmed` has no page behind it.
  - |
    Settled by the reviewer: once a menu or catalogue API exists, the backend must recompute prices from server-side menu data and calculate totals, taxes and discounts; client prices are display-only. No such API exists today (the menu is web-side), so in this story `POST /orders` stores the client's line names and prices as a display-only snapshot, computes and stores no total, and takes no payment. The recompute belongs to the story that adds the catalogue API; this story must not treat the stored prices as authoritative.
  - |
    Settled by the reviewer: the address rule is the Indian PIN code, exactly 6 numeric digits, as the last comma-separated part (street, city, PIN). The earlier "postcode" wording and UK-style examples are replaced everywhere in the plan.
  - |
    Phone rule (AC8, 16, 17). 10 to 15 digits after ignoring spaces, hyphens, dots, brackets and a leading +. The ACs fix 9 as too short, 10 as valid and 16 as too long; 15 as the upper bound is an assumption from the 16-digit case.
  - |
    Settled by the reviewer: an unchanged retry reuses the idempotency key, and any change to contact details, fulfilment, address or cart contents after a failed attempt mints a new key. Implemented by comparing a signature of the payload with the one last sent. Known trade-off: if the first attempt actually committed and the customer then edits something, the new key can create a second order; the reviewer accepted this rule.
  - |
    Sketch versus ACs, decided in favour of the ACs: generic "Your order was not placed" alert with Place order enabled again (not "We cannot deliver to this address" with a disabled button), a phone field the sketch lacks, and a persistent alert rather than a toast. See the `CheckoutScreen` scope item.
  - |
    The sketch note "Can a guest check out without an account?" is answered by the scope and AC11: no. A guest on `/checkout` is redirected to `/sign-in?next=checkout` (already in place); the sign-in prompt itself belongs to the Customer sign-in epic. The settled decision that a guest's cart is kept through sign-in holds because `CartProvider` stores the cart in localStorage.
  - |
    An empty cart on Checkout shows an empty state with a link to the menu. No AC covers it; it stops an empty order being sent, and the API also rejects it with 400.
  - |
    Retention of orders and customer contact details, and backup and recovery of order records, stay a project-level decision (EPIC-026 and CHORE-042) and do not block this story. The reviewer's suggested later policy (orders and audit records 7 years, contact details per privacy and compliance rules) is a recommendation, not a requirement, so this plan adds no expiry job or audit table. The `orders` table stores name, phone and address in plain columns.
  - |
    `GET /orders` is out of scope and this story does not depend on it. The Orders List story owns the API controller, retrieval, filtering, paging and UI. I found no `services/api/src/orders` folder before this plan; this story creates that folder for `POST /orders` only, so the Orders List story should add its `GET` to the same controller and service.
estimated_points: 8
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: the migration only creates a new table, a sequence and indexes. No existing table or row is altered, so players, wallets, sessions and appointments are unaffected. The new foreign key points at `players(id)` and applies to new rows only. There are no existing orders rows, so no existing-row readability test applies.
  - **Backfill / seed**: none. The sequence is created by the migration and starts at 1001. All statements use `if not exists`, so re-running is safe.
  - **Settings**: none. No new env var or config file. The web app keeps using `RECORDS_API_URL` for the rewrite in `apps/web/next.config.ts`.
  - **Provisioning**: nothing outside the migration. The existing migration runner that applies `001` to `003` must apply `004`; the implementer should confirm how 003 is applied and follow the same path.
  - **Order and rollback**: migrate first, then deploy the API, then the web app, because the web page calls `POST /orders`. The new table is used only by the new endpoint, so leaving it in place after a code rollback is safe; to remove it, drop `orders` and `orders_number_seq`. The migration style here has no down scripts.

  ### How the tokens reach the app
  `apps/web/src/app/globals.css:2` imports `../../../../design-system/tokens.css` after `@import "tailwindcss"` on line 1. New CSS uses only `var(--...)` tokens, all confirmed in `design-system/tokens.css` or already used by existing rules in `globals.css` (`--space-*`, `--color-focus`, `--size-control`, `--size-check`, `--border-width-strong`, `--size-focus-offset`).

  ### Sketch coverage
  - Screen `checkout` (radio-group, name input, address input, order summary list, Place order): `CheckoutScreen`, `OrderSummary` and the `.radio-group` CSS, plus the phone field the ACs add.
  - Screen `checkout-error` (`state_of: checkout`): the `failed` state of `CheckoutScreen` (alert plus kept values and cart).
  - Flow `to-checkout-error` (place-order, "Order fails"): the failure branch of the submit handler.
  - Exit `to-confirmation` (place-order to confirmation): `router.push` to `/order-confirmed?number=<n>`; the destination screen is the Order confirmed story's.
  - The `menu` screen and the header (logo, nav, cart control) already exist as `MenuGrid`, `TopBar` and `MenuCart`; they are not redrawn.

  ### Shape of the change

  ```mermaid
  flowchart TD
    Page["app/checkout/page.tsx"] --> Screen["CheckoutScreen"]
    Screen --> Summary["OrderSummary"]
    Screen --> CheckoutLib["lib/checkout.ts"]
    Screen --> Provider["CartProvider useCart"]
    Provider --> CartLib["lib/cart.ts and cartStorage.ts"]
    Screen --> Icon["components/orders/Icon.tsx"]
    Page --> Session["lib/session.ts getSession"]
    CheckoutLib -->|"POST /api/orders (rewrite)"| Next["next.config.ts"]
    Next --> Ctrl["orders.controller.ts"]
    Ctrl --> Guard["session.guard.ts"]
    Ctrl --> Svc["orders.service.ts"]
    Svc --> Db["database.service.ts"]
    Db --> Mig["004_orders.sql"]
    AppMod["app.module.ts"] --> OrdersMod["orders.module.ts"]
    OrdersMod --> Ctrl
    classDef touched fill:#f96,color:#000
    class Page,Screen,Summary,CheckoutLib,Provider,Ctrl,Svc,Mig,AppMod,OrdersMod touched
  ```

  Touched: the page renders the screen after the guest redirect; `CartProvider` gains `clear` and `hydrated`; `next.config.ts` already forwards `/api/orders` (checked, not changed); the controller, service and migration are the new order-creation path; `app.module.ts` registers the module.

  ### Duplicate submissions (deferred question)
  Two layers. The client disables the button while pending (AC20) and reuses one idempotency key for retries. The server enforces it with the unique (player_id, idempotency_key) index plus `on conflict do nothing`, then returns the existing order. Two concurrent identical requests cannot both insert.

  ### Order numbers (deferred question)
  The number comes from the `orders_number_seq` sequence as a column default and is shown as a plain string like "1001". A sequence never hands out the same value twice, including across concurrent transactions, and the unique index is a backstop. Gaps are possible after a rolled-back insert and are acceptable for a display number. Nothing in the item asks for an unguessable number.

  ### Order of work (TDD)
  1. `orders.validation.spec.ts`, then `orders.validation.ts`.
  2. `orders.service.spec.ts` (with the migration pin), then `004_orders.sql` and `orders.service.ts`.
  3. `orders.controller.spec.ts`, then the controller and module, wired into `app.module.ts`.
  4. `checkout.test.ts`, then `lib/checkout.ts`; `CartProvider.test.tsx`, then `clear` and `hydrated`.
  5. `OrderSummary.test.tsx` and `CheckoutScreen.test.tsx`, then the components and CSS.
  6. `shell.test.ts`, the checkout page test, then `ORDER_CONFIRMED_HREF` and the page wiring.
  7. e2e spec and mock server.

  Narrow test commands (from the project command, keeping the runner and flags):
  - `(cd services/api && pnpm run test -- orders)`
  - `(cd apps/web && pnpm test -- src/components/checkout src/components/cart/CartProvider.test.tsx src/lib/checkout.test.ts src/app/checkout src/lib/shell.test.ts)`
review_focus: |
  IN: `POST /orders` and `004_orders.sql` (session-owned order, server-side validation with a 6-digit PIN code rule, idempotency key, sequence number), the `/checkout` screen with its failure state, `clear` and `hydrated` on the existing `CartProvider`, and navigation to `/order-confirmed`. OUT: Menu and Cart editing (already shipped), the Order confirmed page (another story's), server-side price recompute (needs a catalogue API), the guest sign-in prompt, payments, time choice, `GET /orders` and retention. Riskiest: the idempotency key rule (an unchanged retry reuses the key, any edit to details or cart mints a new one) while a failed submit keeps every value and the cart, that clearing the cart on success does not flash the empty state, and that the API (not just the form) refuses invalid input and guests. Deliberate: the plan follows the ACs over the sketch's address-specific error and disabled button on the error screen, and it reuses the localStorage cart rather than adding a second store.
