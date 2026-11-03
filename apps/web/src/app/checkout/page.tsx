import { redirect } from "next/navigation";
import { CheckoutScreen } from "@/components/checkout/CheckoutScreen";
import { getSession } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function CheckoutPage() {
  // Guests sign in first; `next=checkout` brings them back here afterwards.
  if ((await getSession()) === null) {
    redirect(`${SIGN_IN_HREF}?next=checkout`);
  }
  return <CheckoutScreen />;
}
