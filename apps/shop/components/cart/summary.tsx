"use client";

import { useActionState } from "react";

import { Price } from "@/components/product/price";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/client";
import type { Cart } from "@/lib/cart/types";
import { checkoutAction } from "@/lib/checkout/action";

export function CartSummary({ cart }: { cart: Cart }) {
  const { isUpdating } = useCart();
  const [error, checkout, isOpening] = useActionState(checkoutAction, undefined);
  const hasProblems = cart.lines.some((line) => line.problems.length > 0);
  const status = !cart.checkoutOpen
    ? "Plata online se deschide în curând."
    : hasProblems
      ? "Rezolvă mai întâi produsele marcate în coș."
      : error;
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
      <form action={checkout} className="grid gap-2.5">
        <Button
          className="h-12 w-full justify-center"
          disabled={!cart.checkoutOpen || hasProblems || isUpdating || isOpening}
          type="submit"
        >
          {isOpening ? "Se deschide plata…" : "Mergi la plată"}
        </Button>
        <p className="text-xs text-muted-foreground" role="status">
          {status ?? "Plătești pe pagina securizată a Stripe."}
        </p>
      </form>
    </div>
  );
}
