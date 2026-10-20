import type { MetadataRoute } from "next";

import { shopConfig } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#fbf8f3",
    description: shopConfig.site.description,
    display: "standalone",
    icons: [
      { sizes: "192x192", src: "/icons/icon-192.png", type: "image/png" },
      { sizes: "512x512", src: "/icons/icon-512.png", type: "image/png" },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/icon-maskable-512.png",
        type: "image/png",
      },
    ],
    name: shopConfig.site.name,
    short_name: shopConfig.site.name,
    start_url: "/",
    theme_color: "#fbf8f3",
  };
}
