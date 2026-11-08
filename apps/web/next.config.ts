import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@infraos/shared-types"],
  poweredByHeader: false,
  distDir: process.env.INFRAOS_NEXT_DIST_DIR || ".next",
  turbopack: {},
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
