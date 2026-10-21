"use server";

import { api } from "@jolene/backend/convex/_generated/api";
import { errors } from "@jolene/backend/convex/utils/errors";
import { fetchAction } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { CART_COOKIE } from "@/lib/cart";

function describeError(error: unknown): string {
  const code = error instanceof ConvexError ? error.data : undefined;
  if (code === errors.checkoutUnavailable) return "Plata online se deschide în curând.";
  if (code === errors.cartEmpty) return "Coșul e gol.";
  if (code === errors.cartNotReady) return "Rezolvă mai întâi produsele marcate în coș.";
  if (code === errors.tooMany) return "Prea multe încercări. Mai încearcă peste câteva minute.";
  if (code === errors.unlockNowNeeded)
    return "Bifează că vrei invitația digitală deblocată imediat după plată.";
  return "Nu am putut deschide plata. Încearcă din nou.";
}

// Once the shop and Convex share SHOP_SECRET, Convex opens Stripe's page only for the shop's
// server, which says who the visitor is by the address Vercel saw them at, in x-forwarded-for:
// each visitor then has a limit of their own, so one can't use up everyone's checkouts. Trimmed
// as Convex trims its own, so a pasted newline doesn't keep the two from matching.
async function fromServer() {
  const secret = process.env.SHOP_SECRET?.trim();
  if (!secret) return {};
  const visitor = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return { server: { secret, visitor: visitor || "unknown" } };
}

// Sends the couple to Stripe's page for their cart as Convex prices it now, or says why not.
export async function checkoutAction(
  _previous: string | undefined,
  form: FormData,
): Promise<string | undefined> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return describeError(new ConvexError(errors.cartEmpty));
  const unlockNow = form.get("unlockNow") === "on";
  let url: string;
  try {
    url = await fetchAction(api.checkout.start, {
      language: "ro",
      token,
      unlockNow,
      ...(await fromServer()),
    });
  } catch (error) {
    return describeError(error);
  }
  redirect(url);
}
