import path from "node:path";
import type { NextConfig } from "next";

// RECORDS_API_URL: base URL of the Records API (default http://localhost:4000). The browser only
// talks to /api/*, which is proxied here, so no CORS is needed.
const nextConfig: NextConfig = {
  // globals.css imports the shared design-system/ at the repo root, outside apps/web.
  turbopack: { root: path.join(__dirname, "../..") },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.RECORDS_API_URL ?? "http://localhost:4000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
