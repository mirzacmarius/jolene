import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import { withBotId } from "botid/next/config";
import { withEve } from "eve/next";
import type { NextConfig } from "next";

import { shopConfig } from "./lib/config";
import { withShopConfig } from "./lib/config/server";

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
  // jolene.ro's WooCommerce addresses, so links and search results find the products and categories here.
  async redirects() {
    return [
      {
        destination: "/products/invitatie-nunta-white-roses",
        permanent: true,
        source: "/produs/invitatie_nunta_white_roses",
      },
      { destination: "/products/:handle", permanent: true, source: "/produs/:handle" },
      {
        destination: "/collections/all",
        permanent: true,
        source: "/categorie-produs/:handle(fara-categorie|uncategorized)/:rest*",
      },
      {
        destination: "/collections/:handle",
        permanent: true,
        source: "/categorie-produs/:parent/:handle/page/:page",
      },
      {
        destination: "/collections/:handle",
        permanent: true,
        source: "/categorie-produs/:handle/page/:page",
      },
      {
        destination: "/collections/:handle",
        permanent: true,
        source: "/categorie-produs/:parent/:handle",
      },
      { destination: "/collections/:handle", permanent: true, source: "/categorie-produs/:handle" },
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
  withMicrofrontends,
]);
