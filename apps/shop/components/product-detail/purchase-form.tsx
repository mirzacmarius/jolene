"use client";

import { MAX_QUANTITY } from "@jolene/backend/convex/shop/pricing";
import { Loader2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { InviteCard, InviteCardMissing, InviteCardSkeleton } from "@/components/invite/invite-card";
import { ProofCard } from "@/components/proof/proof-card";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { useCartActions, useCartDrawer } from "@/lib/cart/client";
import type { InviteEvent } from "@/lib/invite/types";
import {
  getDefaultAnswers,
  getExtrasPerItem,
  getMissingOptions,
  toCartAnswers,
} from "@/lib/line-options";
import { formatPrice } from "@/lib/money";
import { getDefaultSelectedOptions, getSurcharges } from "@/lib/product";
import type { ProductDetails } from "@/lib/product/types";
import type { ProductProof } from "@/lib/proof/types";

import { LineOptionsFields } from "./line-options";
import { OptionPicker } from "./option-picker";
import { ProductPrice } from "./product-price";

const LABELS = new Intl.ListFormat("ro", { type: "conjunction" });

interface PurchaseFormProps {
  /** While the page still reads the proof or event it may carry: the same form, not yet usable. */
  disabled?: boolean;
  /** The event a product bought for an event is for, from the studio's link. */
  event?: InviteEvent | null;
  product: ProductDetails;
  proof?: ProductProof | null;
}

export function PurchaseForm({ disabled = false, event, product, proof }: PurchaseFormProps) {
  const { add } = useCartActions();
  const drawer = useCartDrawer();
  const errorId = useId();
  const minQuantity = product.minQuantity ?? 1;
  const [selected, setSelected] = useState(() => getDefaultSelectedOptions(product.options));
  const [answers, setAnswers] = useState(() => getDefaultAnswers(product.lineOptions));
  const [fees, setFees] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(minQuantity);
  const [error, setError] = useState<string>();
  const [isAdding, setAdding] = useState(false);

  // As convex/shop/pricing.ts prices the line: the paper's surcharge and the paid choices on each piece.
  const addOns =
    getSurcharges(product.options, selected) + getExtrasPerItem(product.lineOptions, answers);
  const price = product.price + addOns;
  const feesTotal = product.fees
    .filter((fee) => fees.includes(fee.key))
    .reduce((sum, fee) => sum + fee.price, 0);
  const missing = getMissingOptions(product.lineOptions, answers);
  // Sold only with the studio's event, and only while its invitation isn't open to every guest.
  const unsellable = product.forEvent && (!event || event.unlocked);

  async function addToCart(submit: FormEvent) {
    submit.preventDefault();
    if (missing.length || unsellable) return;
    setAdding(true);
    setError(undefined);
    const problem = await add({
      answers: toCartAnswers(product.lineOptions, answers),
      fees,
      handle: product.handle,
      options: product.options.flatMap((option) =>
        selected[option.name] ? [{ name: option.name, value: selected[option.name] }] : [],
      ),
      eventId: event?.id,
      proofId: proof?.id,
      quantity: product.forEvent ? 1 : quantity,
    });
    setAdding(false);
    if (problem) setError(problem);
    else drawer.open();
  }

  return (
    <form aria-describedby={error ? errorId : undefined} onSubmit={addToCart}>
      <fieldset className="grid min-w-0 gap-10" disabled={disabled || isAdding}>
        <legend className="sr-only">Comandă</legend>
        <ProductPrice
          compareAtPrice={
            product.compareAtPrice === undefined ? undefined : product.compareAtPrice + addOns
          }
          price={price}
          unit={product.forEvent ? "pentru toată lista de invitați" : undefined}
        />
        {proof ? <ProofCard proof={proof} /> : null}
        {product.forEvent ? (
          disabled ? (
            <InviteCardSkeleton />
          ) : event ? (
            <InviteCard event={event} />
          ) : (
            <InviteCardMissing />
          )
        ) : null}
        {product.options.length ? (
          <div className="grid gap-5">
            {product.options.map((option) => (
              <OptionPicker
                key={option.name}
                onSelect={(value) =>
                  setSelected((current) => ({ ...current, [option.name]: value }))
                }
                option={option}
                selected={selected[option.name]}
              />
            ))}
          </div>
        ) : null}
        <LineOptionsFields
          answers={answers}
          chosenFees={fees}
          fees={product.fees}
          onAnswer={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))}
          onFee={(key, chosen) =>
            setFees((current) => [
              ...current.filter((fee) => fee !== key),
              ...(chosen ? [key] : []),
            ])
          }
          options={product.lineOptions}
        />
        <div className="grid gap-2.5">
          {missing.length ? (
            <p className="text-sm text-muted-foreground" role="status">
              Completează {LABELS.format(missing.map((option) => `„${option.label}”`))} ca să adaugi
              în coș.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2.5">
            {product.forEvent ? null : (
              <QuantityInput
                disabled={disabled || isAdding}
                max={MAX_QUANTITY}
                min={minQuantity}
                onChange={setQuantity}
                value={quantity}
              />
            )}
            <Button
              className="h-12 min-w-40 flex-1"
              disabled={missing.length > 0 || (!disabled && unsellable)}
              type="submit"
            >
              {isAdding ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {isAdding ? "Se adaugă…" : "Adaugă în coș"}
            </Button>
          </div>
          {product.forEvent ? null : (
            <p className="text-sm text-muted-foreground" role="status">
              {quantity} buc.: {formatPrice(price * quantity + feesTotal)}
              {minQuantity > 1 ? ` · comandă minimă ${minQuantity} buc.` : null}
            </p>
          )}
          {error ? (
            <p className="text-sm text-destructive" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
