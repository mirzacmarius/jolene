"use client";

import { getShopPayButtonUrl } from "@shopify/hydrogen";
import { cn } from "cn";
import { Loader2, MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useCartDrawer } from "@/components/cart/context";
import { Button } from "@/components/ui/button";
import { MAX_QUANTITY } from "@/lib/line-options";
import { formatPrice } from "@/lib/money";
import type { Money } from "@/lib/money/types";
import { getProductPurchaseOptions } from "@/lib/product";
import { useProductForm } from "@/lib/product/client";
import type { ProductFormVariant, SellingPlanAllocation } from "@/lib/product/types";

import { BuyWithShopLogo } from "./buy-with-shop-logo";

interface BuyButtonsProps {
  attributes?: Array<{ key: string; value: string }>;
  availableForSale?: boolean;
  buyWithShop?: boolean;
  disabled?: boolean;
  fallbackVariant: ProductFormVariant | undefined;
  minQuantity?: number;
  onAddToCart?: () => void;
  quantityPicker?: boolean;
}

export function BuyButtons({
  attributes = [],
  availableForSale = true,
  buyWithShop = true,
  disabled = false,
  fallbackVariant,
  minQuantity = 1,
  onAddToCart,
  quantityPicker = true,
}: BuyButtonsProps) {
  const { formProps, pending, register, selectedVariant: storeVariant } = useProductForm();
  const selectedVariant = storeVariant ?? fallbackVariant;
  const isSelectionUnresolved = !storeVariant;
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [draftQuantity, setDraftQuantity] = useState(String(minQuantity));
  const quantity = clampQuantity(draftQuantity, minQuantity);
  const [purchaseOption, setPurchaseOption] = useState("");
  const { plans, selectedPlan } = getProductPurchaseOptions(selectedVariant, purchaseOption);
  const missingRequiredPlan = Boolean(selectedVariant?.requiresSellingPlan && !selectedPlan);
  const { openOverlay } = useCartDrawer();

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setIsBuyingNow(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
  if (!selectedVariant) {
    return null;
  }
  const requiresBundleConfiguration = selectedVariant.requiresBundleConfiguration;
  const isOutOfStock = !selectedVariant.availableForSale;
  // Keep href while buying: removing it during the click cancels the anchor's navigation.
  const buyNowUrl = getShopPayButtonUrl({
    disabled: isSelectionUnresolved || isOutOfStock || requiresBundleConfiguration || pending,
    variants: [{ id: selectedVariant.id, quantity }],
  });
  const getButtonText = () => {
    if (pending) return "Se adaugă…";
    if (isSelectionUnresolved) return "Adaugă în coș";
    if (requiresBundleConfiguration) return "Alege produsele din pachet";
    if (missingRequiredPlan) return "Abonament indisponibil";
    if (isOutOfStock) return "Stoc epuizat";
    return "Adaugă în coș";
  };
  return (
    <form
      {...formProps({
        beforeSubmit: (event) => {
          if (
            disabled ||
            isSelectionUnresolved ||
            isOutOfStock ||
            requiresBundleConfiguration ||
            missingRequiredPlan ||
            pending
          ) {
            event.preventDefault();
            return;
          }
          onAddToCart?.();
          openOverlay();
        },
      })}
      className="grid gap-2.5"
    >
      <PurchaseOptions
        disabled={pending || isSelectionUnresolved}
        onSelect={setPurchaseOption}
        plans={plans}
        price={selectedVariant.price}
        requiresSellingPlan={selectedVariant.requiresSellingPlan}
        selectedPlan={selectedPlan}
      />
      <input type="hidden" name="sellingPlanId" value={selectedPlan?.sellingPlan.id ?? ""} />
      <input type="hidden" {...register("merchandiseId", {})} />
      <input type="hidden" {...register("quantity", { value: quantity })} />
      {attributes.map((attribute) => (
        <input key={attribute.key} type="hidden" {...register("attributeValue", attribute)} />
      ))}
      <div className="flex flex-wrap gap-2.5">
        {quantityPicker ? (
          <div
            aria-label="Cantitate"
            className="grid h-12 w-38 shrink-0 grid-cols-[3rem_3.5rem_3rem] rounded-lg bg-background ring-1 ring-border ring-inset"
            role="group"
          >
            <button
              type="button"
              aria-label="Scade cantitatea"
              className="flex size-12 cursor-pointer items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={quantity <= minQuantity}
              onClick={() => setDraftQuantity(String(clampQuantity(quantity - 1, minQuantity)))}
            >
              <MinusIcon className="size-4 shrink-0" />
            </button>
            <input
              aria-label="Cantitate"
              className="h-12 w-14 [appearance:textfield] bg-transparent text-center text-sm font-medium tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              inputMode="numeric"
              max={MAX_QUANTITY}
              min={minQuantity}
              onBlur={() => setDraftQuantity(String(quantity))}
              onChange={(event) => setDraftQuantity(event.target.value)}
              type="number"
              value={draftQuantity}
            />
            <button
              type="button"
              aria-label="Crește cantitatea"
              className="flex size-12 cursor-pointer items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={quantity >= MAX_QUANTITY}
              onClick={() => setDraftQuantity(String(clampQuantity(quantity + 1, minQuantity)))}
            >
              <PlusIcon className="size-4 shrink-0" />
            </button>
          </div>
        ) : null}
        <Button
          {...register("addToCart", {})}
          data-selection-unresolved={isSelectionUnresolved && !pending}
          disabled={
            disabled ||
            isSelectionUnresolved ||
            isOutOfStock ||
            requiresBundleConfiguration ||
            missingRequiredPlan ||
            pending
          }
          className="h-12 min-w-40 flex-1 justify-center data-[selection-unresolved=true]:disabled:opacity-100"
        >
          {getButtonText()}
        </Button>
      </div>
      {minQuantity > 1 ? (
        <p className="text-sm text-muted-foreground">Comandă minimă: {minQuantity} buc.</p>
      ) : null}
      {buyWithShop && !selectedPlan && !selectedVariant.requiresSellingPlan ? (
        <a
          aria-busy={isBuyingNow || undefined}
          aria-disabled={buyNowUrl ? undefined : true}
          aria-label="Cumpără cu Shop Pay"
          className={cn(
            "flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-shop px-4 text-white transition-colors hover:bg-shop/85 aria-busy:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-[selection-unresolved=true]:aria-disabled:opacity-100",
            !availableForSale && "invisible",
          )}
          data-selection-unresolved={isSelectionUnresolved}
          href={buyNowUrl ?? undefined}
          onClick={(event) => {
            if (!buyNowUrl || isBuyingNow) {
              event.preventDefault();
              return;
            }
            setIsBuyingNow(true);
          }}
          rel="nofollow"
        >
          {isBuyingNow ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <span className="sr-only">Cumpără cu</span>
              <BuyWithShopLogo aria-hidden="true" className="h-auto w-24.5" />
            </>
          )}
        </a>
      ) : null}
    </form>
  );
}

interface PurchaseOptionsProps {
  disabled?: boolean;
  onSelect?: (id: string) => void;
  plans: SellingPlanAllocation[];
  price: Money;
  requiresSellingPlan: boolean;
  selectedPlan: SellingPlanAllocation | undefined;
}

export function PurchaseOptions({
  disabled = false,
  onSelect,
  plans,
  price,
  requiresSellingPlan,
  selectedPlan,
}: PurchaseOptionsProps) {
  const purchaseOptionId = useId();
  if (plans.length === 0) return null;

  return (
    <fieldset className="grid gap-2.5" disabled={disabled}>
      <legend className="pb-2.5 text-sm font-medium">Cum cumperi</legend>
      {[
        ...(!requiresSellingPlan ? [{ id: "", name: "O singură dată", price }] : []),
        ...plans.map((allocation) => ({
          id: allocation.sellingPlan.id,
          name: allocation.sellingPlan.name,
          price: allocation.price,
        })),
      ].map((option) => (
        <label
          key={option.id}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-4 has-checked:border-foreground has-disabled:cursor-not-allowed has-disabled:opacity-50"
        >
          <input
            type="radio"
            name={purchaseOptionId}
            value={option.id}
            checked={(selectedPlan?.sellingPlan.id ?? "") === option.id}
            onChange={onSelect ? () => onSelect(option.id) : undefined}
            readOnly={!onSelect}
            className="size-4 cursor-pointer accent-foreground disabled:cursor-not-allowed"
          />
          <span className="flex flex-1 flex-wrap items-center justify-between gap-2.5 text-sm">
            <span>{option.name}</span>
            <span className="tabular-nums">{formatPrice(option.price)}</span>
          </span>
        </label>
      ))}
      {selectedPlan ? (
        <p className="text-sm text-muted-foreground">
          Cumpărare recurentă.{" "}
          {selectedPlan.sellingPlan.description || "Detaliile abonamentului apar la plată."}
        </p>
      ) : null}
    </fieldset>
  );
}

function clampQuantity(value: number | string, minQuantity: number): number {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity)
    ? Math.min(MAX_QUANTITY, Math.max(minQuantity, quantity))
    : minQuantity;
}
