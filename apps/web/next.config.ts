import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.INFRAOS_NEXT_DIST_DIR || ".next",
};

export default nextConfig;
