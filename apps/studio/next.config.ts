import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";
import "./src/env";
import { photoHosts } from "./src/lib/photos";

const nextConfig: NextConfig = {
  // Each page is prerendered into a static shell per language, and a link
  // prefetches only that shell; designs and the catalog then come from Convex
  // on the client.
  cacheComponents: true,
  partialPrefetching: true,
  // The products' photos, which the collections show first, are up to 2048
  // pixels a side; the optimizer sends each screen a size that fits it.
  images: {
    remotePatterns: photoHosts.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
    minimumCacheTTL: 31536000,
  },
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
  async headers() {
    return [
      // Every page, as the shop's: no other site may frame it to trick a
      // click, browsers take each file as the type it says, links elsewhere
      // carry only the address's origin, and no page may ask for the camera,
      // the microphone or the visitor's location.
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Jolene's artwork: each file's name carries a hash of its content, so
      // a changed file is a new address and browsers can keep every one for
      // good.
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
