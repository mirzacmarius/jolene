import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { env } from "@/env";

/**
 * What the shop shows of a proof (api.proofs.summary), at the studio's
 * address on the shop's domain: the product page reads it from the browser to
 * show the couple's design and put it on the cart line.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const summary = await fetchQuery(
    api.proofs.summary,
    { proofId: id },
    { url: env.NEXT_PUBLIC_CONVEX_URL },
  );
  return Response.json(summary, {
    status: summary ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
