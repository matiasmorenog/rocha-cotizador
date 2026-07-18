import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit outside the bundle so AFM font files resolve from node_modules
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
