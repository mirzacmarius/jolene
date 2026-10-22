import { randomBytes } from "node:crypto";

import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

import { CART_COOKIE } from "@/lib/cart";
import type { Cart } from "@/lib/cart/types";

const CART_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

// The token is the cart's only key, so it's long, random and out of the page's reach.
// Only a server action or a route handler can set the cookie for a new cart.
export async function cartToken(): Promise<string> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (token) return token;
  const made = randomBytes(32).toString("base64url");
  store.set(CART_COOKIE, made, {
    httpOnly: true,
    maxAge: CART_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  return made;
}

// Never cached across requests: a cart is one visitor's, priced from the catalog as it is now.
export const getCart = cache(async (): Promise<Cart | null> => {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  // At request time only: Next's prefetch render has the visitor's cookies but refuses Convex's client, which draws a random id.
  await connection();
  return fetchQuery(api.cart.get, { token });
});
