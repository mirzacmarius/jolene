"use server";

import { api } from "@jolene/backend/convex/_generated/api";
import { errors } from "@jolene/backend/convex/utils/errors";
import { fetchAction } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CART_COOKIE } from "@/lib/cart";

function describeError(error: unknown): string {
  const code = error instanceof ConvexError ? error.data : undefined;
  if (code === errors.checkoutUnavailable) return "Plata online se deschide în curând.";
  if (code === errors.cartEmpty) return "Coșul e gol.";
  if (code === errors.cartNotReady) return "Rezolvă mai întâi produsele marcate în coș.";
  if (code === errors.tooMany) return "Prea multe încercări. Mai încearcă peste câteva minute.";
  return "Nu am putut deschide plata. Încearcă din nou.";
}

// Sends the couple to Stripe's page for their cart as Convex prices it now, or says why not.
export async function checkoutAction(_previous: string | undefined): Promise<string | undefined> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return describeError(new ConvexError(errors.cartEmpty));
  let url: string;
  try {
    url = await fetchAction(api.checkout.start, { language: "ro", token });
  } catch (error) {
    return describeError(error);
  }
  redirect(url);
}
