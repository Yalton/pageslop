import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Reuse visited dashboard pages on back-and-forth navigation instead of
    // refetching them (Next 15 defaults to 0s for dynamic pages). Their data
    // loads client-side through SWR, so a cached page shell is never stale.
    staleTimes: { dynamic: 300 },
  },
};

export default nextConfig;
