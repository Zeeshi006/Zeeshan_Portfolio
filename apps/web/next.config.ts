import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@portfolio/ui", "@portfolio/types"],
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ["@portfolio/ui", "framer-motion"],
  },
};

export default nextConfig;
