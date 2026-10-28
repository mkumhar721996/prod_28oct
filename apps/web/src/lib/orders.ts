export type OrderStatus = "Received" | "Preparing" | "Ready for pickup" | "Fulfilled" | "Cancelled";
export type Order = {
  id: string;
  number: string;
  title: string;
  status: OrderStatus;
  placedAt: string;
};
export type OrdersTab = "active" | "past";
export type OrdersPage = { items: Order[]; nextCursor: string | null; hasAnyOrders: boolean };

export const ORDERS_HREF = "/orders";
export const ORDERS_PAGE_SIZE = 20;

// The browser calls /api/orders on the web origin; next.config.ts rewrites it (cookies included) to
// the API's GET /orders. It is not /orders because that path is the page itself. The endpoint and
// its response shape are assumed until the API story defines them.
const ORDERS_API_PATH = "/api/orders";

/** Fulfilled and cancelled orders are past; everything else (not yet fulfilled) is active. */
export function tabOf(status: OrderStatus): OrdersTab {
  return status === "Fulfilled" || status === "Cancelled" ? "past" : "active";
}

/** Adds a page to the loaded orders: no duplicate ids, newest first. */
export function mergePage(loaded: Order[], page: Order[]): Order[] {
  const byId = new Map<string, Order>();
  for (const o of [...loaded, ...page]) byId.set(o.id, o);
  return [...byId.values()].sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));
}

/** Where a signed-out visitor goes to sign in; `next` brings them back to Orders. */
export function ordersSignInHref(): string {
  return `/sign-in?next=${encodeURIComponent(ORDERS_HREF)}`;
}

/** Client side: one page of the signed-in customer's orders. Rejects on failure. */
export async function fetchOrdersPage(tab: OrdersTab, cursor: string | null): Promise<OrdersPage> {
  const params = new URLSearchParams({ tab, limit: String(ORDERS_PAGE_SIZE) });
  if (cursor !== null) params.set("cursor", cursor);
  const res = await fetch(`${ORDERS_API_PATH}?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Orders request failed (${res.status})`);
  return (await res.json()) as OrdersPage;
}

export type TabState = {
  items: Order[];
  nextCursor: string | null;
  status: "loading-first" | "error-first" | "idle" | "loading-more" | "error-more";
};

export type TabAction =
  | { type: "first-requested" }
  | { type: "first-failed" }
  | { type: "first-loaded"; items: Order[]; nextCursor: string | null }
  | { type: "more-requested" }
  | { type: "more-loaded"; items: Order[]; nextCursor: string | null }
  | { type: "more-failed" };

export const INITIAL_TAB_STATE: TabState = { items: [], nextCursor: null, status: "loading-first" };

export function ordersReducer(state: TabState, action: TabAction): TabState {
  switch (action.type) {
    case "first-requested":
      return { ...state, status: "loading-first" };
    case "first-failed":
      return { ...state, status: "error-first" };
    case "first-loaded":
      return { items: mergePage([], action.items), nextCursor: action.nextCursor, status: "idle" };
    case "more-requested":
      return { ...state, status: "loading-more" };
    case "more-loaded":
      return {
        items: mergePage(state.items, action.items),
        nextCursor: action.nextCursor,
        status: "idle",
      };
    case "more-failed":
      return { ...state, status: "error-more" };
  }
}
