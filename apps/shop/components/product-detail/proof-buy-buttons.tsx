"use client";

import { type ComponentProps } from "react";

import { BuyButtons } from "@/components/product-detail/buy-buttons";
import { useLineOptionsOrder } from "@/components/product-detail/line-options";
import { ProofCard, ProofCardSkeleton } from "@/components/proof/proof-card";
import { shopConfig } from "@/lib/config";
import { useProductForm } from "@/lib/product/client";
import { getProofAttributes } from "@/lib/proof";
import { useProductProof } from "@/lib/proof/client";

const LABELS = new Intl.ListFormat(shopConfig.localization.locale, { type: "conjunction" });

interface ProofBuyButtonsProps extends ComponentProps<typeof BuyButtons> {
  handle: string;
}

export function ProofBuyButtons({
  buyWithShop,
  fallbackVariant,
  handle,
  ...props
}: ProofBuyButtonsProps) {
  const { id, proof } = useProductProof(handle);
  const { selectedVariant } = useProductForm();
  const order = useLineOptionsOrder();
  const merchandiseId = (selectedVariant ?? fallbackVariant)?.id;
  const proofAttributes = id && proof ? getProofAttributes(id, proof) : [];
  return (
    <div className="grid gap-5">
      {proof ? <ProofCard proof={proof} /> : proof === undefined ? <ProofCardSkeleton /> : null}
      {order.missing.length || order.unavailable ? (
        <p className="text-sm text-muted-foreground" role="status">
          {order.unavailable
            ? "Opțiunile alese nu se pot comanda online. Scrie-ne și pregătim noi comanda."
            : `Completează ${LABELS.format(order.missing.map((option) => `„${option.label}”`))} ca să adaugi în coș.`}
        </p>
      ) : null}
      <BuyButtons
        {...props}
        attributes={merchandiseId ? order.getAttributes(merchandiseId, proofAttributes) : undefined}
        // Shop Pay's buy-now link skips the cart, and with it a proof, extras and fees.
        buyWithShop={buyWithShop && proof === null && !order.hasLineOptions}
        disabled={proof === undefined || order.missing.length > 0 || order.unavailable}
        fallbackVariant={fallbackVariant}
        minQuantity={order.minQuantity}
      />
    </div>
  );
}
