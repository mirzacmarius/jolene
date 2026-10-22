import { photoStore } from "@jolene/products/photos";

/**
 * Where the shop's product photos load from (ADR 0016): the photo store,
 * Convex's storage for those the workshop uploads, and jolene.ro until it
 * closes. The studio's image optimizer fetches from these alone.
 */
export const photoHosts = [
  ...(photoStore ? [new URL(photoStore).hostname] : []),
  "*.convex.cloud",
  "jolene.ro",
];

/**
 * Whether the studio's image optimizer may fetch a photo; one from anywhere
 * else, such as a local Convex backend's storage, loads as it is.
 */
export function optimizable(url: string): boolean {
  let hostname: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    hostname = parsed.hostname;
  } catch {
    return false;
  }
  return photoHosts.some((host) =>
    host.startsWith("*.")
      ? hostname.endsWith(host.slice(1))
      : hostname === host,
  );
}
