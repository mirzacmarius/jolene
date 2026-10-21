"use client";

import { useActionState } from "react";

import { Price } from "@/components/product/price";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useCart } from "@/lib/cart/client";
import type { Cart } from "@/lib/cart/types";
import { checkoutAction } from "@/lib/checkout/action";
import { LEGAL_PAGES } from "@/lib/legal";
import { formatPrice } from "@/lib/money";

const LINK_CLASS = "underline underline-offset-4 hover:text-foreground";

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
        {cart.delivery ? (
          <p className="text-muted-foreground text-xs">
            {cart.delivery.price > 0
              ? `Livrare prin curier: ${formatPrice(cart.delivery.price)}, gratuită de la ${formatPrice(cart.delivery.freeFrom)}.`
              : "Livrare prin curier gratuită."}{" "}
            Sau ridici comanda gratuit din atelierul din Iași. Alegi la plată.
          </p>
        ) : null}
      </div>
      <form action={checkout} className="grid gap-2.5">
        {cart.unlockNow ? (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
              name="unlockNow"
              required
              type="checkbox"
            />
            <span>
              Vreau ca invitația digitală să fie deblocată imediat după plată și înțeleg că, odată
              deblocată, nu mai pot renunța la ea în 14 zile (
              <Link className={LINK_CLASS} href={LEGAL_PAGES.returns.ro.path}>
                politica de retur
              </Link>
              ).
            </span>
          </label>
        ) : null}
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
        <p className="text-xs text-muted-foreground">
          Plătind, accepți{" "}
          <Link className={LINK_CLASS} href={LEGAL_PAGES.terms.ro.path}>
            termenii și condițiile
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
