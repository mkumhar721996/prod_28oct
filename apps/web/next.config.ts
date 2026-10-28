import type { NextConfig } from "next";

const apiUrl = process.env.RECORDS_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // The browser calls /session/* on the web origin; forward it (cookies included) to the API.
  async rewrites() {
    return [{ source: "/session/:path*", destination: `${apiUrl}/session/:path*` }];
  },
};

export default nextConfig;
