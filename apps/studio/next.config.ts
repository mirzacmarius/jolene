import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";
import "./src/env";

const nextConfig: NextConfig = {
  // Each page is prerendered into a static shell per language, and a link
  // prefetches only that shell; designs and the catalog then come from Convex
  // on the client.
  cacheComponents: true,
  partialPrefetching: true,
  // Reached on its own, without the shop around it, the studio's root is
  // outside the studio; send it there rather than to a 404.
  async redirects() {
    return [{ source: "/", destination: "/studio", permanent: false }];
  },
  // The workshop's print files (api/print-files) draw Jolene's artwork from
  // the studio's own files, so the function that makes them carries them.
  outputFileTracingIncludes: {
    "/studio/api/print-files/[order]/[line]": ["./public/studio/art/**/*"],
  },
  // Jolene's artwork: each file's name carries a hash of its content, so a
  // changed file is a new address and browsers can keep every one for good.
  async headers() {
    return [
      {
        source: "/studio/art/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

// The shop's domain serves the studio at /studio: Vercel Microfrontends routes
// those paths here (apps/shop/microfrontends.json) and gives this app's assets
// a prefix of their own, so a design and the cart it's ordered from share one
// origin and one set of cookies.
export default withMicrofrontends(nextConfig);
