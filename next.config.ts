import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
