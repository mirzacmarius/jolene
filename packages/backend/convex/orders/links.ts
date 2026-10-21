import { env } from "../_generated/server";

/**
 * The shop's address, without a trailing slash: the studio's own, since the
 * studio is served at /studio on it. Null until SITE_URL is set.
 */
export function shopUrl(): string | null {
  const site = env.SITE_URL?.trim();
  if (!site) return null;
  try {
    return new URL(site).origin;
  } catch {
    return null;
  }
}

/** An order's page in the shop, which its emails link to. */
export function orderUrl(shop: string, token: string): string {
  return `${shop}/orders/${token}`;
}
