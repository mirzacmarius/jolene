"use client";

import { MAX_QUANTITY } from "@jolene/backend/convex/shop/pricing";
import { Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { InviteImage } from "@/components/invite/invite-card";
import { Price } from "@/components/product/price";
import { ProofImage } from "@/components/proof/proof-card";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Link } from "@/components/ui/link";
import { QuantityInput } from "@/components/ui/quantity-input";
import { describeLineProblem } from "@/lib/cart";
import { useCartActions } from "@/lib/cart/client";
import type { CartLine } from "@/lib/cart/types";
import { formatPrice } from "@/lib/money";

export function CartLineItems({ lines }: { lines: CartLine[] }) {
  return (
    <ul aria-label="Produse în coș" className="grid gap-5">
      {lines.map((line) => (
        <CartLineItem key={line.id} line={line} />
      ))}
    </ul>
  );
}

function CartLineItem({ line }: { line: CartLine }) {
  const { remove, setQuantity } = useCartActions();
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const href = line.event
    ? `/products/${line.handle}?event=${line.event.id}`
    : `/products/${line.handle}`;

  async function change(action: () => Promise<string | undefined>) {
    setPending(true);
    setError(await action());
    setPending(false);
  }

  return (
    <li aria-busy={isPending || undefined} aria-label={line.title} className="flex gap-2.5">
      <Link
        className="relative size-18 shrink-0 cursor-pointer self-start overflow-hidden bg-accent transition-opacity hover:opacity-80"
        href={href}
      >
        {line.event ? (
          <InviteImage className="size-full" event={line.event} />
        ) : line.proof ? (
          <ProofImage className="size-full" fit="cover" proof={line.proof} />
        ) : line.image ? (
          <Image
            alt={line.image.alt || line.title}
            className="object-cover"
            fill
            sizes="100vw"
            src={line.image.url}
          />
        ) : (
          <ImagePlaceholder className="size-full" />
        )}
      </Link>
      <div className="grid min-h-18 min-w-0 flex-1 gap-2.5 pt-0.5">
        <div className="grid gap-1">
          <Link className="cursor-pointer transition-opacity hover:opacity-70" href={href}>
            <h3 className="line-clamp-1 text-sm font-medium text-foreground">{line.title}</h3>
          </Link>
          {line.options.length ? (
            <p className="text-xs text-muted-foreground">
              {line.options.map((option) => option.value).join(" / ")}
            </p>
          ) : null}
          {line.answers.map((answer) => (
            <p
              className="line-clamp-3 text-xs break-words text-muted-foreground"
              key={answer.label}
            >
              {answer.label}: {answer.value}
            </p>
          ))}
          {line.proof ? <p className="text-xs text-muted-foreground">Cu designul vostru</p> : null}
          {line.event?.hosts.ro ? (
            <p className="text-xs text-muted-foreground">Pentru {line.event.hosts.ro}</p>
          ) : null}
          {line.event ? null : (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatPrice(line.price)} / buc.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 self-end">
          {line.event ? null : (
            <QuantityInput
              disabled={isPending}
              max={MAX_QUANTITY}
              min={Math.min(line.quantity, line.minQuantity ?? 1)}
              onChange={(quantity) => change(() => setQuantity(line.id, quantity))}
              size="sm"
              value={line.quantity}
            />
          )}
          <button
            aria-label="Scoate din coș"
            className="flex cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isPending}
            onClick={() => change(() => remove(line.id))}
            type="button"
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
        {line.problems.length || error ? (
          <ul className="grid gap-0.5 text-xs text-amber-800 dark:text-amber-200/90" role="alert">
            {line.problems.map((problem) => (
              <li key={describeLineProblem(problem)}>{describeLineProblem(problem)}</li>
            ))}
            {error ? <li>{error}</li> : null}
          </ul>
        ) : null}
      </div>
      <div className="grid gap-0.5 self-start py-0.5 text-right">
        <Price
          amount={line.total}
          className="text-sm font-medium data-[pending=true]:text-muted-foreground"
          data-pending={isPending}
        />
        {line.compareAtPrice && line.compareAtPrice > line.price ? (
          <Price
            amount={line.compareAtPrice * line.quantity}
            className="text-xs text-muted-foreground line-through"
          />
        ) : null}
      </div>
    </li>
  );
}
