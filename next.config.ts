import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit: AFM fonts from node_modules; web-push: avoid bundling HTTP/crypto
  serverExternalPackages: ["pdfkit", "web-push"],
};

export default nextConfig;
