import type { OrderStatus } from "@/lib/orders";
import { Icon, type IconName } from "./Icon";

const BADGES: Record<OrderStatus, { tone: string; icon: IconName }> = {
  Received: { tone: "badge-info", icon: "info" },
  Preparing: { tone: "badge-warning", icon: "loader" },
  "Ready for pickup": { tone: "badge-success", icon: "bell" },
  Fulfilled: { tone: "badge-success", icon: "check" },
  Cancelled: { tone: "badge-danger", icon: "x" },
};

/** Read-only status: colour is always paired with an icon and the status word. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { tone, icon } = BADGES[status];
  return (
    <span className={`badge ${tone} order-badge`}>
      <Icon name={icon} />
      {status}
    </span>
  );
}
