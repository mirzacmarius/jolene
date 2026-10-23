import { photoStore } from "@jolene/products/photos";

/**
 * The host of the Convex deployment the studio was built against, whose
 * storage keeps the photos the workshop uploads. Only its own: any Convex
 * deployment's would let strangers have their pictures optimized and served
 * from Jolene's address. A local backend, over http, has none.
 */
function convexHost(): string | undefined {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");
    return url.protocol === "https:" ? url.hostname : undefined;
  } catch {
    return undefined;
  }
}

const convex = convexHost();

/**
 * Where the shop's product photos load from (ADR 0016): the photo store,
 * Convex's storage for those the workshop uploads, and jolene.ro until it
 * closes. The studio's image optimizer fetches from these alone.
 */
export const photoHosts = [
  ...(photoStore ? [new URL(photoStore).hostname] : []),
  ...(convex ? [convex] : []),
  "jolene.ro",
];

/**
 * Whether the studio's image optimizer may fetch a photo; one from anywhere
 * else, such as a local Convex backend's storage, loads as it is.
 */
export function optimizable(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && photoHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}
