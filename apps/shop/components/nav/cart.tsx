import { HandbagIcon } from "lucide-react";

import { getCart } from "@/lib/cart/server";

import { CartIconClient } from "./cart-client";

// The server's count shows until the browser has the cart, so the badge doesn't flash empty.
export async function CartIcon() {
  const cart = await getCart().catch(() => null);
  return <CartIconClient cartLabel="Coș" initialCount={cart?.count ?? 0} />;
}

export function CartIconFallback() {
  return (
    <span className="flex items-center justify-center gap-1.5 text-foreground">
      <HandbagIcon className="size-5" />
      <span className="sr-only">Coș</span>
    </span>
  );
}
