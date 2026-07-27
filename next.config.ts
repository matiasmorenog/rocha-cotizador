import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit: AFM fonts from node_modules; web-push: avoid bundling HTTP/crypto
  serverExternalPackages: ["pdfkit", "web-push"],
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
