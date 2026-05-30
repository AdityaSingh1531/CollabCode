import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle in .next/standalone
  // Required for Docker / Cloud Run deployment without node_modules
  output: "standalone",
};

export default nextConfig;
