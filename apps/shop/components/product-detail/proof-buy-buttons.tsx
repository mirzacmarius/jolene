"use client";

import { type ComponentProps } from "react";

import { BuyButtons } from "@/components/product-detail/buy-buttons";
import { ProofCard, ProofCardSkeleton } from "@/components/proof/proof-card";
import { getProofAttributes } from "@/lib/proof";
import { useProductProof } from "@/lib/proof/client";

interface ProofBuyButtonsProps extends ComponentProps<typeof BuyButtons> {
  handle: string;
}

export function ProofBuyButtons({ buyWithShop, handle, ...props }: ProofBuyButtonsProps) {
  const { id, proof } = useProductProof(handle);
  return (
    <div className="grid gap-5">
      {proof ? <ProofCard proof={proof} /> : proof === undefined ? <ProofCardSkeleton /> : null}
      <BuyButtons
        {...props}
        attributes={id && proof ? getProofAttributes(id, proof) : undefined}
        // Shop Pay's buy-now link skips the cart, and a proof with it.
        buyWithShop={buyWithShop && proof === null}
        disabled={proof === undefined}
      />
    </div>
  );
}
