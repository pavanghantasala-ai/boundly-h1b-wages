import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable static optimization for problematic pages
  generateBuildId: async () => {
    return 'build-cache-' + Date.now()
  },
  generateEtags: false,
};

export default nextConfig;
