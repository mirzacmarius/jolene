import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { cookies } from "next/headers";
import { cache } from "react";

import { CART_COOKIE } from "@/lib/cart";
import type { Cart } from "@/lib/cart/types";

// Never cached across requests: a cart is one visitor's, priced from the catalog as it is now.
export const getCart = cache(async (): Promise<Cart | null> => {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  return token ? fetchQuery(api.cart.get, { token }) : null;
});
