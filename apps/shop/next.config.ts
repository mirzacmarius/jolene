import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";

import { withShopConfig } from "./lib/config/server";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    deviceSizes: [1320, 1920],
    imageSizes: [],
    minimumCacheTTL: 31536000,
    // The catalog's photos load from jolene.ro until they're copied into Convex's storage.
    remotePatterns: [
      { hostname: "jolene.ro", protocol: "https" },
      { hostname: "*.convex.cloud", protocol: "https" },
    ],
    unoptimized: !!process.env.V0_CALLBACK_URL,
  },
  partialPrefetching: true,
  reactCompiler: true,
  // Guests' links on invitatie.jolene.ro are short, /<invitation>/<family code>: they go to the studio's /invitatie on the same address, and the address's root to Jolene.
  // jolene.ro's WooCommerce addresses, so links and search results find the products and categories here.
  async redirects() {
    const guests = [{ type: "host" as const, value: "invitatie\\..+" }];
    return [
      { destination: "https://jolene.ro", has: guests, permanent: false, source: "/" },
      {
        destination: "/invitatie/:invitation/:rest*",
        has: guests,
        permanent: false,
        source: "/:invitation([a-z0-9-]+)/:rest*",
      },
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

export default withShopConfig(nextConfig, [withMicrofrontends]);
