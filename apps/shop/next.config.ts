import { withBotId } from "botid/next/config";
import { withEve } from "eve/next";
import type { NextConfig } from "next";

import { shopConfig } from "./lib/config";
import { withShopConfig } from "./lib/config/server";

// /studio is the designer (apps/studio), a separate deployment served on this domain.
const studioUrl = process.env.STUDIO_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    deviceSizes: [1320, 1920],
    imageSizes: [],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        hostname: "cdn.shopify.com",
        protocol: "https",
      },
    ],
    unoptimized: !!process.env.V0_CALLBACK_URL,
  },
  partialPrefetching: true,
  reactCompiler: true,
  async rewrites() {
    return [
      { destination: `${studioUrl}/studio`, source: "/studio" },
      { destination: `${studioUrl}/studio/:path*`, source: "/studio/:path*" },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        as: "*.css",
        loaders: ["@tailwindcss/turbopack"],
      },
    },
  },
};

export default withShopConfig(nextConfig, [
  shopConfig.botid.isEnabled && withBotId,
  shopConfig.agent.isEnabled && withEve,
]);
