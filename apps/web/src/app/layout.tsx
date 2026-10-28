import type { Metadata } from "next";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web App",
  description: "comp_web_app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="shell-header">
            <div className="shell-bar">
              <Link className="shell-brand" href="/">
                Web App
              </Link>
              <AppNav />
            </div>
          </header>
          <main className="shell-main">{children}</main>
          <footer className="shell-footer">
            <div>Web App</div>
          </footer>
        </div>
      </body>
    </html>
  );
}
