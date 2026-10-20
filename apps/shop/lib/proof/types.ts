import type { ProductKind } from "@jolene/design";

// What the studio answers at /studio/api/proofs/<id> for a proof a couple approved.
export interface ProofSummary {
  approvedAt: number;
  designId: string;
  image: string | null;
  kind: ProductKind;
  product: string | null;
  suite: { en: string; ro: string };
}
