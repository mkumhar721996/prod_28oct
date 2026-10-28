import type { Metadata } from "next";
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
        <div className="shell">
          <TopBarControls signedIn={session !== null} />
          <main className="shell-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
