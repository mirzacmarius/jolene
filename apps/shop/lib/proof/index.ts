import { productKindLabels } from "@jolene/design";

import { shopConfig } from "@/lib/config";

import type { ProofSummary } from "./types";

// Shopify keeps underscored attributes off the checkout; the order and its webhooks still carry them.
export const PROOF_ATTRIBUTE = "_proof";

export function formatApproval(proof: Pick<ProofSummary, "approvedAt">): string {
  return new Intl.DateTimeFormat(shopConfig.localization.locale, { dateStyle: "long" }).format(
    proof.approvedAt,
  );
}

export function describeProof(proof: Pick<ProofSummary, "kind" | "suite">): string {
  return `${productKindLabels[proof.kind].ro} ${proof.suite.ro}`;
}

export function getProofAttributes(
  id: string,
  proof: ProofSummary,
): Array<{ key: string; value: string }> {
  return [
    { key: PROOF_ATTRIBUTE, value: id },
    { key: "Bun de tipar", value: `aprobat pe ${formatApproval(proof)}` },
  ];
}

export function getLineProofId(
  attributes: ReadonlyArray<{ key: string; value?: string | null }>,
): string | undefined {
  return attributes.find((attribute) => attribute.key === PROOF_ATTRIBUTE)?.value ?? undefined;
}
