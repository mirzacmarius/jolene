"use client";

import { Price } from "@/components/product/price";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/client";
import type { Cart } from "@/lib/cart/types";

export function CartSummary({ cart }: { cart: Cart }) {
  const { isUpdating } = useCart();
  const hasProblems = cart.lines.some((line) => line.problems.length > 0);
  return (
    <div className="grid gap-5">
      <div aria-busy={isUpdating || undefined} className="grid gap-2.5" role="group">
        {cart.fees.map((fee) => (
          <div className="flex items-baseline justify-between gap-2.5 text-sm" key={fee.key}>
            <span>
              {fee.label} <span className="text-muted-foreground">(o dată pe comandă)</span>
            </span>
            <Price amount={fee.price} className="text-sm" />
          </div>
        ))}
        <div className="flex items-baseline justify-between text-base text-foreground">
          <span>Total</span>
          {isUpdating ? (
            <span className="font-medium text-muted-foreground text-xl">Se actualizează…</span>
          ) : (
            <Price amount={cart.total} className="font-medium text-xl" />
          )}
        </div>
        <p className="text-muted-foreground text-xs">Livrarea se calculează la plată.</p>
      </div>
      <div className="grid gap-2.5">
        {/* Jolene's own checkout (Stripe) takes over here next; until then the button waits. */}
        <Button className="h-12 w-full justify-center" disabled type="button">
          Mergi la plată
        </Button>
        <p className="text-xs text-muted-foreground" role="status">
          {hasProblems
            ? "Rezolvă mai întâi produsele marcate în coș."
            : "Plata online se deschide în curând."}
        </p>
      </div>
    </div>
  );
}
