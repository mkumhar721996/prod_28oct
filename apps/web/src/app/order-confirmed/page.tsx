import { redirect } from "next/navigation";
import { OrderConfirmedScreen } from "@/components/orders/OrderConfirmedScreen";
import { isOrderNumber, ordersSignInHref } from "@/lib/orders";
import { ORDERS_HREF } from "@/lib/shell";
import { getSession } from "@/lib/session";

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  // A signed-out visitor has no order to confirm; sign-in returns them to Orders.
  if ((await getSession()) === null) redirect(ordersSignInHref());
  const { order } = await searchParams;
  // The number is display-only: only its format is checked, not existence or ownership.
  if (!isOrderNumber(order)) redirect(ORDERS_HREF);
  return <OrderConfirmedScreen orderNumber={order} />;
}
