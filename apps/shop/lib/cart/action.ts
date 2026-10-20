"use server";

import { getCart } from "@/lib/cart/server";
import { findOrderProblem } from "@/lib/line-options/server";
import { withFallback } from "@/lib/shopify/errors/server";

// Checkout can't hold an order to its minimum or options without Shopify Plus, so the cart's button does.
export async function prepareCheckoutAction(): Promise<{
  checkoutUrl: string | null;
  problem?: string;
}> {
  const cart = await withFallback(getCart(), undefined);
  const problem = cart
    ? await withFallback(findOrderProblem(cart.lines.nodes), undefined)
    : undefined;
  if (problem) return { checkoutUrl: null, problem };
  return { checkoutUrl: cart?.checkoutUrl ?? null };
}
