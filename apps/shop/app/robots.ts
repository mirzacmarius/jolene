import type { MetadataRoute } from "next";

import { shopConfig } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/cart", "/checkout/", "/orders/", "/search", "/collections/*?*sort_by="],
      },
    ],
    sitemap: `${shopConfig.site.url}/sitemap.xml`,
  };
}
