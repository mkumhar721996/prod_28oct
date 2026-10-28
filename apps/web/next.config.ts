import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // globals.css imports the shared design-system/ at the repo root, outside apps/web.
  turbopack: { root: path.join(__dirname, "../..") },
};

export default nextConfig;
