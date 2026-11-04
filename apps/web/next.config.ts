import type { NextConfig } from "next";

const apiUrl = process.env.RECORDS_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // The browser calls /session/* on the web origin; forward it (cookies included) to the API.
  async rewrites() {
    return [
      { source: "/session/:path*", destination: `${apiUrl}/session/:path*` },
      { source: "/staff/session/:path*", destination: `${apiUrl}/staff/session/:path*` },
      { source: "/auth/session/:path*", destination: `${apiUrl}/auth/session/:path*` },
      // Same reason: /organizations and /accounts are the pages themselves.
      { source: "/api/organizations", destination: `${apiUrl}/organizations` },
      { source: "/api/organizations/:path*", destination: `${apiUrl}/organizations/:path*` },
      { source: "/api/accounts", destination: `${apiUrl}/accounts` },
      // Under /api because /orders is the Orders page itself.
      { source: "/api/orders", destination: `${apiUrl}/orders` },
      // Same reason: /appointments is the page itself.
      { source: "/api/appointments", destination: `${apiUrl}/appointments` },
      { source: "/api/appointments/:path*", destination: `${apiUrl}/appointments/:path*` },
      // Same reason: /onboarding-templates is the page itself.
      { source: "/api/onboarding-templates", destination: `${apiUrl}/onboarding-templates` },
      {
        source: "/api/onboarding-templates/:path*",
        destination: `${apiUrl}/onboarding-templates/:path*`,
      },
      // Same reason: /alerts is the page itself.
      { source: "/api/alerts", destination: `${apiUrl}/alerts` },
      { source: "/api/alerts/:path*", destination: `${apiUrl}/alerts/:path*` },
      // Same reason: /wallet is the page itself.
      { source: "/api/wallet/top-up", destination: `${apiUrl}/wallet/top-up` },
    ];
  },
};

export default nextConfig;
