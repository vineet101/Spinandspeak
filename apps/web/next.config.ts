import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@spin-and-speak/domain",
    "@spin-and-speak/scoring",
    "@spin-and-speak/api-types",
    "@spin-and-speak/storage"
  ],
  poweredByHeader: false
};

export default nextConfig;
