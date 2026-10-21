import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";

import type { ProductProof } from "./types";

// The studio sends an approved design to its product's page as ?proof=<id>; a proof of another product shows nothing.
export async function getProductProof(
  id: string | undefined,
  handle: string,
): Promise<ProductProof | null> {
  if (!id) return null;
  await connection();
  const proof = await fetchQuery(api.proofs.summary, { proofId: id });
  return proof?.product === handle ? { ...proof, id } : null;
}
