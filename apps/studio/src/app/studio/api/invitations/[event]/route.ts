import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { env } from "@/env";

/**
 * What the shop shows of the digital invitation a cart line opens
 * (api.invites.forShop), at the studio's address on the shop's domain: the
 * digital invitation's product page reads it from the browser to show whose
 * invitation it is and put the event on the cart line.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ event: string }> },
) {
  const { event } = await params;
  const summary = await fetchQuery(
    api.invites.forShop,
    { eventId: event },
    { url: env.NEXT_PUBLIC_CONVEX_URL },
  );
  return Response.json(summary, {
    status: summary ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
