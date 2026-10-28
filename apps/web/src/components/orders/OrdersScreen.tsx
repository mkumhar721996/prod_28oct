"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import {
  INITIAL_TAB_STATE,
  fetchOrdersPage,
  ordersReducer,
  type OrdersPage,
  type OrdersTab,
  type TabState,
} from "@/lib/orders";
import { Icon } from "./Icon";
import { NoOrders } from "./NoOrders";
import { OrderRow } from "./OrderRow";

type FetchPage = (tab: OrdersTab, cursor: string | null) => Promise<OrdersPage>;

const TABS: readonly { id: OrdersTab; label: string; listLabel: string; empty: string }[] = [
  {
    id: "active",
    label: "Active",
    listLabel: "Active orders",
    empty: "You have no active orders right now. Past orders are under the Past tab.",
  },
  { id: "past", label: "Past", listLabel: "Past orders", empty: "You have no past orders yet." },
];

export type OrdersScreenProps = {
  fetchPage?: FetchPage;
  /** Starting state, for rendering a given state without effects (tests). */
  initial?: { tab?: OrdersTab; active?: TabState; past?: TabState; hasAnyOrders?: boolean };
};

export function OrdersScreen({ fetchPage = fetchOrdersPage, initial }: OrdersScreenProps) {
  const [tab, setTab] = useState<OrdersTab>(initial?.tab ?? "active");
  const [hasAnyOrders, setHasAnyOrders] = useState(initial?.hasAnyOrders ?? true);
  const [active, dispatchActive] = useReducer(ordersReducer, initial?.active ?? INITIAL_TAB_STATE);
  const [past, dispatchPast] = useReducer(ordersReducer, initial?.past ?? INITIAL_TAB_STATE);
  const states = { active, past };
  const dispatchers = { active: dispatchActive, past: dispatchPast };
  const state = states[tab];

  const requested = useRef<Record<OrdersTab, boolean>>({
    active: initial?.active !== undefined,
    past: initial?.past !== undefined,
  });

  const loadFirst = useCallback(() => {
    const dispatch = tab === "active" ? dispatchActive : dispatchPast;
    dispatch({ type: "first-requested" });
    fetchPage(tab, null).then(
      (page) => {
        if (!page.hasAnyOrders) setHasAnyOrders(false);
        dispatch({ type: "first-loaded", items: page.items, nextCursor: page.nextCursor });
      },
      () => dispatch({ type: "first-failed" }),
    );
  }, [tab, fetchPage]);

  // First page of a tab: on mount for Active, on first visit for Past.
  useEffect(() => {
    if (requested.current[tab]) return;
    requested.current[tab] = true;
    loadFirst();
  }, [tab, loadFirst]);

  const loadMore = useCallback(() => {
    if (state.nextCursor === null) return;
    dispatchers[tab]({ type: "more-requested" });
    fetchPage(tab, state.nextCursor).then(
      (page) =>
        dispatchers[tab]({ type: "more-loaded", items: page.items, nextCursor: page.nextCursor }),
      () => dispatchers[tab]({ type: "more-failed" }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, state.nextCursor, fetchPage]);

  // Automatic paging: fetch the next page when the end of the list scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  const canAutoLoad = state.status === "idle" && state.nextCursor !== null;
  useEffect(() => {
    const el = sentinel.current;
    if (!canAutoLoad || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [canAutoLoad, loadMore, state.items.length]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = TABS[(TABS.findIndex((t) => t.id === tab) + step + TABS.length) % TABS.length];
    setTab(next.id);
    document.getElementById(`orders-tab-${next.id}`)?.focus();
  }

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="stack stack-4">
      <h1 className="text-3xl font-semibold">Your orders</h1>
      <div className="stack stack-2">
        <div className="tabs" role="tablist" aria-label="Orders">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`orders-tab-${t.id}`}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === t.id}
              aria-controls="orders-panel"
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={onKeyDown}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          className="tab-panel"
          id="orders-panel"
          role="tabpanel"
          aria-labelledby={`orders-tab-${tab}`}
        >
          {!hasAnyOrders ? (
            <NoOrders />
          ) : state.status === "loading-first" ? (
            <div className="stack stack-2" role="status" aria-label="Loading your orders">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card stack stack-2">
                  <span className="skeleton" />
                  <span className="skeleton" />
                </div>
              ))}
            </div>
          ) : state.status === "error-first" ? (
            <RetryAlert
              message="We couldn't load your orders. Check your connection and try again."
              onRetry={loadFirst}
            />
          ) : (
            <>
              {state.items.length === 0 ? (
                <div className="state-row">{current.empty}</div>
              ) : (
                <ul className="order-list" aria-label={current.listLabel}>
                  {state.items.map((o) => (
                    <OrderRow key={o.id} order={o} />
                  ))}
                </ul>
              )}
              {state.status === "loading-more" && <LoadingMore />}
              {state.status === "error-more" && (
                <RetryAlert
                  message="We couldn't load more orders. Your other orders are still shown. Check your connection and try again."
                  onRetry={loadMore}
                />
              )}
              <div ref={sentinel} aria-hidden="true" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingMore() {
  return (
    <div className="state-row" role="status">
      <span className="spinner" aria-hidden="true" />
      Loading more orders…
    </div>
  );
}

function RetryAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="alert alert-danger" role="alert">
      <Icon name="alert" />
      <span>{message}</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
