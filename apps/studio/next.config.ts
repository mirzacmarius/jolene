import type { NextConfig } from "next";
import "./src/env";

const nextConfig: NextConfig = {
  // The shop serves the studio on its own domain at /studio (its rewrite
  // sends /studio/* here), so a design and the cart it's ordered from share
  // one origin and one set of cookies.
  basePath: "/studio",
  // Each page is prerendered into a static shell per language, and a link
  // prefetches only that shell; designs and the catalog then come from Convex
  // on the client.
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
