import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit: AFM fonts from node_modules; web-push: avoid bundling HTTP/crypto
  serverExternalPackages: ["pdfkit", "web-push"],
  // Unique per Vercel deploy so the client can detect a stale JS bundle.
  env: {
    NEXT_PUBLIC_APP_BUILD_ID:
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "dev",
  },
  // Never reuse soft-nav RSC payloads for dynamic (auth) segments across visits.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
