import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Reuse visited dashboard pages on back-and-forth navigation instead of
    // refetching them (Next 15 defaults to 0s for dynamic pages). Their data
    // loads client-side through SWR, so a cached page shell is never stale.
    staleTimes: { dynamic: 300 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV !== "production") }];
  },
};

export default nextConfig;
