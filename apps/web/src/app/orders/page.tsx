import { redirect } from "next/navigation";
import { OrdersScreen } from "@/components/orders/OrdersScreen";
import { ordersSignInHref } from "@/lib/orders";
import { getSession } from "@/lib/session";

export default async function OrdersPage() {
  // Signed-out visitors never get Orders markup; sign-in brings them back via `next`.
  if ((await getSession()) === null) redirect(ordersSignInHref());
  return <OrdersScreen />;
}
