import { api } from "@jolene/backend/convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

// Stripe sends the couple here once they've paid. Their order is recorded now if Stripe's webhook hasn't yet.
export async function GET(request: NextRequest) {
  const session = request.nextUrl.searchParams.get("session_id") ?? "";
  const token = await fetchAction(api.checkout.confirm, { session }).catch(() => null);
  redirect(token ? `/orders/${token}` : "/checkout/pending");
}
