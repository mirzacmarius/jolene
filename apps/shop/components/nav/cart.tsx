import { HandbagIcon } from "lucide-react";

import { getCart } from "@/lib/cart/server";
import { countProductLines } from "@/lib/line-options";
import { withFallback } from "@/lib/shopify/errors/server";

import { CartIconClient } from "./cart-client";

export async function CartIcon() {
  const cart = await withFallback(getCart(), undefined);
  return (
    <CartIconClient cartLabel="Coș" initialCount={cart ? countProductLines(cart.lines.nodes) : 0} />
  );
}

export function CartIconFallback() {
  return (
    <span className="flex items-center justify-center gap-1.5 text-foreground">
      <HandbagIcon className="size-5" />
      <span className="sr-only">Coș</span>
    </span>
  );
}
