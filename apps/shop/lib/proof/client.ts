"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { ProofSummary } from "./types";

const proofs = new Map<string, Promise<ProofSummary | null>>();

// /studio is the studio, another app on this domain, which answers for the proofs it keeps.
function fetchProof(id: string): Promise<ProofSummary | null> {
  const known = proofs.get(id);
  if (known) return known;
  const proof = fetch(`/studio/api/proofs/${encodeURIComponent(id)}`).then(async (response) => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`The studio answered ${response.status} for proof ${id}`);
    return (await response.json()) as ProofSummary;
  });
  proofs.set(id, proof);
  proof.catch(() => proofs.delete(id));
  return proof;
}

// Undefined while the studio is asked; null for no proof.
export function useProof(id: string | undefined): ProofSummary | null | undefined {
  const [answer, setAnswer] = useState<{ id: string; proof: ProofSummary | null }>();
  useEffect(() => {
    if (!id) return;
    let isCurrent = true;
    fetchProof(id)
      .catch(() => null)
      .then((proof) => {
        if (isCurrent) setAnswer({ id, proof });
      });
    return () => {
      isCurrent = false;
    };
  }, [id]);
  if (!id) return null;
  return answer?.id === id ? answer.proof : undefined;
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
