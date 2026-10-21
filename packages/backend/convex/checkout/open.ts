import { env } from "../_generated/server";
import { shopUrl } from "../orders/links";

/**
 * Paying online is set up on this deployment: it has Stripe's key, and
 * knows the shop's address for Stripe to send couples back to.
 */
export function checkoutOpen(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim()) && shopUrl() !== null;
}
