"use client";

import type { CartLine as HydrogenCartLine } from "@shopify/hydrogen";
import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";

import { ProofImage } from "@/components/proof/proof-card";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Link } from "@/components/ui/link";
import { useCart } from "@/lib/cart/client";
import type { CartLine } from "@/lib/cart/types";
import {
  EXTRAS_FOR_ATTRIBUTE,
  getLineAttribute,
  getLineRole,
  LINE_ATTRIBUTE,
  MAX_QUANTITY,
} from "@/lib/line-options";
import { formatPrice } from "@/lib/money";
import { getLineProofId } from "@/lib/proof";
import { useProof } from "@/lib/proof/client";

import { CartLineForm } from "./line-form";
import { CartWarnings } from "./warnings";

interface CartLineItemsProps {
  lines: CartLine[];
}

export function CartLineItems({ lines }: CartLineItemsProps) {
  const keys = getLineRowKeys(lines);
  const extrasLines = getExtrasLines(lines);
  const nested = new Set(extrasLines.values());
  return (
    <ul className="grid gap-5" aria-label="Produse în coș">
      {lines.map((line, index) =>
        nested.has(line) ? null : (
          <CartLineItem
            extras={extrasLines.get(getLineAttribute(line, LINE_ATTRIBUTE) ?? "")}
            item={line}
            key={keys[index]}
          />
        ),
      )}
    </ul>
  );
}

// An extras line shows under its product line; one whose product line is gone shows alone until the cart removes it.
function getExtrasLines(lines: CartLine[]) {
  const products = new Set(
    lines
      .filter((line) => getLineRole(line) === "product")
      .map((line) => getLineAttribute(line, LINE_ATTRIBUTE)),
  );
  const extrasLines = new Map<string, CartLine>();
  for (const line of lines) {
    const lineId = getLineAttribute(line, EXTRAS_FOR_ATTRIBUTE);
    if (lineId && products.has(lineId) && !extrasLines.has(lineId)) extrasLines.set(lineId, line);
  }
  return extrasLines;
}

// Shopify replaces a new line's `optimistic:` ID on confirmation, so rows key by the identity Hydrogen matches lines on.
function getLineRowKeys(lines: CartLine[]) {
  const keys = lines.map((line) =>
    JSON.stringify([
      line.merchandise?.id ?? line.id,
      line.sellingPlanAllocation?.sellingPlan.id ?? null,
      (line.attributes ?? []).map(({ key, value }) => JSON.stringify([key, value])).sort(),
    ]),
  );
  return keys.map((key, index) =>
    keys.indexOf(key) === keys.lastIndexOf(key) ? key : lines[index].id,
  );
}

interface CartLineItemProps {
  extras?: CartLine;
  item: CartLine;
}

function CartLineItem({ extras, item }: CartLineItemProps) {
  const isPending = useCart((state) => state.pending.lines.has(item.id));
  const isCostPending = useCart((state) =>
    Boolean(state.pending.cost || state.revalidating || state.pending.lines.has(item.id)),
  );
  const { cost, merchandise, quantity } = item;
  const instructions = "instructions" in item ? item.instructions : undefined;
  // The cart keeps extras and fee lines in step with their products, so only product lines take changes.
  const role = getLineRole(item);
  const canUpdateQuantity =
    role === "product" &&
    !(
      instructions &&
      typeof instructions === "object" &&
      "canUpdateQuantity" in instructions &&
      instructions.canUpdateQuantity === false
    );
  const canRemove =
    role === "product" &&
    !(
      instructions &&
      typeof instructions === "object" &&
      "canRemove" in instructions &&
      instructions.canRemove === false
    );
  const minQuantity = Math.max(1, Number(merchandise?.product.minQuantity?.value) || 1);
  const components = (item as HydrogenCartLine).lineComponents ?? [];
  const isOptimistic = item.id.startsWith("optimistic:");
  const currencyCode = cost.totalAmount.currencyCode;
  const finalUnitPrice = quantity > 0 ? Number(cost.totalAmount.amount) / quantity : 0;
  const sellingUnitPrice = Number(cost.amountPerQuantity.amount);
  const compareAtUnitPrice = Number(cost.compareAtAmountPerQuantity?.amount ?? 0);
  const originalUnitPrice =
    finalUnitPrice < sellingUnitPrice ? sellingUnitPrice : compareAtUnitPrice;
  const title = merchandise?.product.title || "Produs";
  // Shopify gives a product without variants one synthetic Title/Default Title option.
  const variantOptions = (merchandise?.selectedOptions ?? []).filter(
    (option) => !(option.name === "Title" && option.value === "Default Title"),
  );
  const href =
    role === "product" && merchandise?.product.handle
      ? `/products/${merchandise.product.handle}`
      : undefined;
  const attributes = item.attributes ?? [];
  const proof = useProof(getLineProofId(attributes));
  const image = merchandise?.image;
  const imageContent = proof?.image ? (
    <ProofImage className="size-full" fit="cover" proof={proof} />
  ) : image?.url ? (
    <Image
      src={image.url}
      alt={image.altText || title}
      fill
      className="object-cover"
      sizes="100vw"
    />
  ) : (
    <ImagePlaceholder className="size-full" />
  );
  const price = (amount: number) => formatPrice({ amount: String(amount), currencyCode });

  return (
    <li className="flex gap-2.5" aria-busy={isPending || undefined} aria-label={title}>
      {href ? (
        <Link
          href={href}
          className="relative size-18 shrink-0 cursor-pointer self-start overflow-hidden transition-opacity hover:opacity-80"
        >
          {imageContent}
        </Link>
      ) : (
        <div className="relative size-18 shrink-0 self-start overflow-hidden">{imageContent}</div>
      )}
      <div className="grid min-h-18 min-w-0 flex-1 gap-2.5 pt-0.5">
        <div className="grid gap-2.5">
          <div className="grid gap-1">
            {href ? (
              <Link href={href} className="cursor-pointer transition-opacity hover:opacity-70">
                <h3 className="line-clamp-1 text-sm font-medium text-foreground">{title}</h3>
              </Link>
            ) : (
              <h3 className="line-clamp-1 text-sm font-medium text-foreground">{title}</h3>
            )}
            {variantOptions.length ? (
              <p className="text-xs text-muted-foreground">
                {variantOptions.map((option) => option.value).join(" / ")}
              </p>
            ) : null}
            {attributes
              .filter((attribute) => attribute.value && !attribute.key.startsWith("_"))
              .map((attribute) => (
                <p key={attribute.key} className="text-xs text-muted-foreground">
                  {attribute.key}: {attribute.value}
                </p>
              ))}
            {item.sellingPlanAllocation ? (
              <p className="text-xs text-muted-foreground">
                {item.sellingPlanAllocation.sellingPlan.name || "Abonament"}
              </p>
            ) : null}
            {extras ? <CartLineExtras line={extras} /> : null}
          </div>
          {components.length ? (
            <div className="grid gap-1">
              <p className="text-xs font-medium text-muted-foreground">Pachetul conține</p>
              <ul className="grid gap-0.5">
                {components.map((component) => (
                  <li
                    key={component.id}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className="truncate">
                      {component.merchandise?.product.title || "Produs din pachet"}
                    </span>
                    {component.quantity > 1 ? <span>×{component.quantity}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {role === "product" ? (
          <CartLineForm
            className="flex items-center gap-1.5 self-end"
            lineId={item.id}
            minQuantity={minQuantity}
            removable={canRemove}
          >
            {(register) => (
              <>
                <div
                  aria-label="Cantitate"
                  className="grid h-6 grid-cols-[1.75rem_2.25rem_1.75rem] rounded-full ring-1 ring-border ring-inset"
                  role="group"
                >
                  <button
                    {...register("decrease")}
                    type="submit"
                    aria-label="Scade cantitatea"
                    className="flex h-6 cursor-pointer items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isOptimistic || !canUpdateQuantity || quantity <= minQuantity}
                  >
                    <MinusIcon className="size-3 shrink-0" />
                  </button>
                  <input
                    key={quantity}
                    {...register("quantity", { interactive: true, value: quantity })}
                    aria-label="Cantitate"
                    className="h-6 w-9 rounded-full bg-transparent text-center text-xs font-medium tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
                    disabled={isOptimistic || !canUpdateQuantity}
                    max={MAX_QUANTITY}
                    min={canRemove ? 0 : minQuantity}
                  />
                  <button
                    {...register("increase")}
                    type="submit"
                    aria-label="Crește cantitatea"
                    className="flex h-6 cursor-pointer items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isOptimistic || !canUpdateQuantity || quantity >= MAX_QUANTITY}
                  >
                    <PlusIcon className="size-3 shrink-0" />
                  </button>
                </div>
                <button
                  {...register("remove")}
                  type="submit"
                  className="flex cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isOptimistic || !canRemove}
                  aria-label="Scoate din coș"
                >
                  <Trash2Icon className="size-4" />
                </button>
              </>
            )}
          </CartLineForm>
        ) : (
          <p className="self-end text-xs text-muted-foreground">
            {role === "fee" ? "O dată pe comandă" : `${quantity} buc.`}
          </p>
        )}
        <CartWarnings lineId={item.id} />
      </div>
      <div className="grid gap-0.5 self-start py-0.5 text-right font-mono text-sm tabular-nums tracking-tight">
        <span
          className="font-medium text-foreground data-[pending=true]:text-muted-foreground"
          data-pending={isCostPending || !currencyCode}
        >
          {isCostPending || !currencyCode ? "Se actualizează…" : price(finalUnitPrice)}
        </span>
        {!isCostPending && currencyCode && originalUnitPrice > finalUnitPrice ? (
          <span className="text-xs text-muted-foreground line-through">
            {price(originalUnitPrice)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function CartLineExtras({ line }: { line: CartLine }) {
  const isPending = useCart((state) =>
    Boolean(state.pending.cost || state.revalidating || state.pending.lines.has(line.id)),
  );
  return (
    <p
      className="text-xs text-muted-foreground data-[pending=true]:opacity-50"
      data-pending={isPending}
    >
      Opțiuni suplimentare: +{formatPrice(line.cost.amountPerQuantity)}/buc.
    </p>
  );
}
