import { MenuCart } from "@/components/cart/MenuCart";
import { MenuGrid } from "@/components/menu/MenuGrid";
import { getSession } from "@/lib/session";

/** Public: guests browse and build a cart; sign-in is only asked for at Checkout. */
export default async function MenuPage() {
  let signedIn = false;
  try {
    signedIn = (await getSession()) !== null;
  } catch {
    // Treat a failing session lookup as a guest, like Home.
  }
  return (
    <div className="stack stack-4">
      <div className="title-row">
        <h1 className="text-3xl font-semibold">Menu</h1>
        <MenuCart signedIn={signedIn} />
      </div>
      <MenuGrid />
    </div>
  );
}
