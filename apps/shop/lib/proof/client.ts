"use client";

import { useSearchParams } from "next/navigation";

import { useStudioAnswer } from "@/lib/studio/client";

import type { ProofSummary } from "./types";

// Undefined while the studio is asked; null for no proof.
export function useProof(id: string | undefined): ProofSummary | null | undefined {
  return useStudioAnswer<ProofSummary>(id ? `/api/proofs/${encodeURIComponent(id)}` : undefined);
}

// The studio sends an approved design to its product's page as ?proof=<id>.
export function useProductProof(handle: string): {
  id: string | undefined;
  proof: ProofSummary | null | undefined;
} {
  const id = useSearchParams().get("proof") ?? undefined;
  const proof = useProof(id);
  return { id, proof: proof && proof.product !== handle ? null : proof };
}
