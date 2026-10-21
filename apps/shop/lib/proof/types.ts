import type { api } from "@jolene/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** What the shop shows of a proof a couple approved in the studio. */
export type ProofSummary = NonNullable<FunctionReturnType<typeof api.proofs.summary>>;

/** A proof of the product whose page the studio sent the couple to, with the id its cart line carries. */
export interface ProductProof extends ProofSummary {
  id: string;
}
