import type { Order } from "@/lib/orders";
import { OrderStatusBadge } from "./OrderStatusBadge";

const PLACED_AT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** A read-only row: deliberately no link, button or handler. */
export function OrderRow({ order }: { order: Order }) {
  return (
    <li className="card order-row">
      <div className="order-row-main">
        <div className="order-row-title">{order.title}</div>
        <div className="order-meta">
          Order #{order.number}, placed {PLACED_AT.format(new Date(order.placedAt))}
        </div>
      </div>
      <OrderStatusBadge status={order.status} />
    </li>
  );
}
