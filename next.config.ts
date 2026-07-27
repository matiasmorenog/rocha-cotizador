import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit outside the bundle so AFM font files resolve from node_modules
  serverExternalPackages: ["pdfkit"],
  // Never reuse soft-nav RSC payloads for dynamic (auth) segments across visits.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
