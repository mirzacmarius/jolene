import { env } from "../_generated/server";

/**
 * The shop's address, without a trailing slash: SHOP_URL's, else SITE_URL's,
 * since the studio is served at /studio on the shop's address. Null until
 * either is set.
 */
export function shopUrl(): string | null {
  for (const url of [env.SHOP_URL, env.SITE_URL]) {
    if (!url?.trim()) continue;
    try {
      return new URL(url.trim()).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/** An order's page in the shop, which its emails link to. */
export function orderUrl(shop: string, token: string): string {
  return `${shop}/orders/${token}`;
}

/** Where an order's invoice downloads from: the shop sends on to its PDF. */
export function invoiceUrl(shop: string, token: string): string {
  return `${orderUrl(shop, token)}/invoice`;
}
