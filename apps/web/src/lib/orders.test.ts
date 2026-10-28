import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchOrdersPage,
  mergePage,
  ordersReducer,
  ordersSignInHref,
  tabOf,
  type Order,
  type TabState,
} from "./orders";

const order = (id: string, placedAt: string): Order => ({
  id,
  number: id,
  title: `Order ${id}`,
  status: "Received",
  placedAt,
});
const old = order("old", "2026-10-26T10:00:00Z");
const mid = order("mid", "2026-10-27T10:00:00Z");
const newest = order("new", "2026-10-28T10:00:00Z");

describe("tabOf", () => {
  it("puts unfulfilled statuses under active", () => {
    for (const s of ["Received", "Preparing", "Ready for pickup"] as const) {
      expect(tabOf(s)).toBe("active");
    }
  });
  it("puts fulfilled and cancelled under past", () => {
    expect(tabOf("Fulfilled")).toBe("past");
    expect(tabOf("Cancelled")).toBe("past");
  });
});

describe("mergePage", () => {
  it("lists newest first", () => {
    expect(mergePage([], [old, newest, mid]).map((o) => o.id)).toEqual(["new", "mid", "old"]);
  });
  it("keeps global order across pages and drops duplicates", () => {
    expect(mergePage([newest], [newest, old])).toHaveLength(2);
    expect(mergePage([newest, old], [mid]).map((o) => o.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("ordersReducer", () => {
  const idle: TabState = { items: [newest], nextCursor: "c1", status: "idle" };
  const loadingMore: TabState = { ...idle, status: "loading-more" };

  it("shows a loading state while a page loads", () => {
    expect(ordersReducer(idle, { type: "more-requested" }).status).toBe("loading-more");
  });
  it("stores the first page", () => {
    const s = ordersReducer(
      { items: [], nextCursor: null, status: "loading-first" },
      { type: "first-loaded", items: [mid], nextCursor: "c" },
    );
    expect(s).toEqual({ items: [mid], nextCursor: "c", status: "idle" });
  });
  it("lets the first page be retried after it fails", () => {
    const loading: TabState = { items: [], nextCursor: null, status: "loading-first" };
    const failed = ordersReducer(loading, { type: "first-failed" });
    expect(failed.status).toBe("error-first");
    expect(ordersReducer(failed, { type: "first-requested" }).status).toBe("loading-first");
  });
  it("appends a later page", () => {
    const s = ordersReducer(loadingMore, { type: "more-loaded", items: [old], nextCursor: null });
    expect(s.items.map((o) => o.id)).toEqual(["new", "old"]);
    expect(s.status).toBe("idle");
    expect(s.nextCursor).toBeNull();
  });
  it("keeps loaded rows and the cursor when a later page fails", () => {
    const next = ordersReducer(loadingMore, { type: "more-failed" });
    expect(next.status).toBe("error-more");
    expect(next.items).toEqual(loadingMore.items);
    expect(next.nextCursor).toBe("c1");
  });
  it("allows retry from the error state", () => {
    const failed = ordersReducer(loadingMore, { type: "more-failed" });
    expect(ordersReducer(failed, { type: "more-requested" }).status).toBe("loading-more");
  });
});

describe("ordersSignInHref", () => {
  it("hands Orders to sign-in as the return target", () => {
    expect(ordersSignInHref()).toBe("/sign-in?next=%2Forders");
  });
});

describe("fetchOrdersPage", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (res: unknown) => {
    const fn = vi.fn().mockResolvedValue(res);
    vi.stubGlobal("fetch", fn);
    return fn;
  };

  it("requests the active tab with the page size", async () => {
    const fn = stub({ ok: true, json: async () => ({ items: [], nextCursor: null, hasAnyOrders: false }) });
    await fetchOrdersPage("active", null);
    const url = String(fn.mock.calls[0][0]);
    expect(url).toContain("/api/orders?");
    expect(url).toContain("tab=active");
    expect(url).toContain("limit=20");
    expect(url).not.toContain("cursor");
  });
  it("requests the past tab with a cursor", async () => {
    const fn = stub({ ok: true, json: async () => ({ items: [], nextCursor: null, hasAnyOrders: true }) });
    await fetchOrdersPage("past", "abc");
    const url = String(fn.mock.calls[0][0]);
    expect(url).toContain("tab=past");
    expect(url).toContain("cursor=abc");
  });
  it("rejects when the response is not ok", async () => {
    stub({ ok: false, status: 500 });
    await expect(fetchOrdersPage("active", null)).rejects.toThrow();
  });
});
