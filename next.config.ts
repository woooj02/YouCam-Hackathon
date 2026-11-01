import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  outputFileTracingExcludes: { "/*": ["./.local/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
