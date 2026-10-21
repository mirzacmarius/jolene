import { env } from "../_generated/server";

/**
 * Who asks to open Stripe's page. Once SHOP_SECRET is set on both, the shop's
 * server sends it with each checkout, and Convex opens Stripe's page for no
 * one else. The shop says then which visitor it asks for, by the address
 * Vercel saw them at, so each visitor has a limit of their own besides the
 * one everyone shares, and a script can't use that one up alone.
 */

/** The secret the shop shares, or null while anyone may open checkouts. */
export function shopSecret(): string | null {
  return env.SHOP_SECRET?.trim() || null;
}

/** Whether a caller sent the secret, compared in constant time. */
export function sameSecret(given: string, secret: string): boolean {
  let differs = given.length ^ secret.length;
  for (let i = 0; i < secret.length; i++)
    differs |= (given.charCodeAt(i) || 0) ^ secret.charCodeAt(i);
  return differs === 0;
}

/**
 * A visitor, for their limit: their IPv4 address, or their IPv6 address's
 * /64, which a home or a server holds whole. The first address counts when
 * there are several, as in x-forwarded-for.
 */
export function visitorKey(address: string): string {
  const ip = address.split(",")[0]?.trim().toLowerCase() ?? "";
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip)?.[1];
  if (mapped) return mapped;
  if (!ip.includes(":")) return ip;
  const [head = "", tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? left
      : [
          ...left,
          ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill(
            "0",
          ),
          ...right,
        ];
  const network = groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""));
  return `${network.join(":")}::/64`;
}
