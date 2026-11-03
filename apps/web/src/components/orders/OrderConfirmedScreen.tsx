"use client";

import { useRouter } from "next/navigation";
import { MENU_HREF, ORDERS_HREF } from "@/lib/shell";

export function OrderConfirmedScreen({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  return (
    <div className="page stack stack-4">
      <h1>Thanks for your order</h1>
      <div role="status">
        <span className="text-muted">Order number</span> <strong data-testid="order-number">{orderNumber}</strong>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={() => router.push(MENU_HREF)}>
          Back to Menu
        </button>
        <button type="button" className="btn btn-primary" onClick={() => router.push(ORDERS_HREF)}>
          View orders
        </button>
      </div>
    </div>
  );
}
