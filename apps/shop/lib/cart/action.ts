"use server";

import { api } from "@jolene/backend/convex/_generated/api";
import { errors } from "@jolene/backend/convex/utils/errors";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { cookies } from "next/headers";

import { CART_COOKIE } from "@/lib/cart";
import { cartToken } from "@/lib/cart/server";
import type { CartActionResult, CartLine, CartLineInput } from "@/lib/cart/types";

function describeError(error: unknown): string {
  const code = error instanceof ConvexError ? error.data : undefined;
  if (code === errors.productUnavailable) return "Produsul nu mai e de vânzare.";
  if (code === errors.invalidLine)
    return "Alegerile nu se mai potrivesc produsului. Reîncarcă pagina și încearcă din nou.";
  if (code === errors.notFound) return "Produsul nu mai e în coș. Reîncarcă pagina.";
  if (code === errors.inviteUnlocked)
    return "Invitația e deschisă deja tuturor invitaților: nu mai e nimic de plătit.";
  return "Nu am putut actualiza coșul. Încearcă din nou.";
}

async function changeCart(
  token: string,
  change: () => Promise<unknown>,
): Promise<CartActionResult> {
  try {
    await change();
  } catch (error) {
    return { cart: await fetchQuery(api.cart.get, { token }), error: describeError(error) };
  }
  return { cart: await fetchQuery(api.cart.get, { token }) };
}

export async function addToCartAction(line: CartLineInput): Promise<CartActionResult> {
  const token = await cartToken();
  return changeCart(token, () =>
    fetchMutation(api.cart.add, {
      answers: line.answers,
      eventId: line.eventId,
      fees: line.fees,
      handle: line.handle,
      options: line.options,
      proofId: line.proofId,
      quantity: line.quantity,
      token,
    }),
  );
}

export async function setCartLineQuantityAction(
  lineId: CartLine["id"],
  quantity: number,
): Promise<CartActionResult> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return { cart: null, error: describeError(new ConvexError(errors.notFound)) };
  return changeCart(token, () => fetchMutation(api.cart.setQuantity, { lineId, quantity, token }));
}

export async function removeCartLineAction(lineId: CartLine["id"]): Promise<CartActionResult> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return { cart: null, error: describeError(new ConvexError(errors.notFound)) };
  return changeCart(token, () => fetchMutation(api.cart.remove, { lineId, token }));
}
