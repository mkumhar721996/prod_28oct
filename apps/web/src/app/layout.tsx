import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/CartProvider";
import { BalanceProvider } from "@/components/BalanceProvider";
import { TopBarControls } from "@/components/TopBarControls";
import { getSession, getWalletBalance } from "@/lib/session";
import { BRAND_NAME } from "@/lib/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "comp_web_app",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const balance = session ? await getWalletBalance().catch(() => null) : null;
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <CartProvider>
          <BalanceProvider initial={balance}>
            <div className="shell">
              <TopBarControls signedIn={session !== null} />
              <main className="shell-main">{children}</main>
            </div>
          </BalanceProvider>
        </CartProvider>
      </body>
    </html>
  );
}
