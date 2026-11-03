import type { Metadata } from "next";
import { UnreadCountProvider } from "@/components/alerts/UnreadCountProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { TopBarControls } from "@/components/TopBarControls";
import { getSession } from "@/lib/session";
import { BRAND_NAME } from "@/lib/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "comp_web_app",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <CartProvider>
          <UnreadCountProvider signedIn={session !== null}>
            <div className="shell">
              <TopBarControls signedIn={session !== null} />
              <main className="shell-main">{children}</main>
            </div>
          </UnreadCountProvider>
        </CartProvider>
      </body>
    </html>
  );
}
