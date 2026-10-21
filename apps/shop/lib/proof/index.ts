import { productKindLabels } from "@jolene/design";

import { shopConfig } from "@/lib/config";

import type { ProofSummary } from "./types";

export function formatApproval(proof: Pick<ProofSummary, "approvedAt">): string {
  return new Intl.DateTimeFormat(shopConfig.localization.locale, { dateStyle: "long" }).format(
    proof.approvedAt,
  );
}

export function describeProof(proof: Pick<ProofSummary, "kind" | "suite">): string {
  return `${productKindLabels[proof.kind].ro} ${proof.suite.ro}`;
}
