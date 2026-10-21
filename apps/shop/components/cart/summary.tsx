"use client";

import type { CartData } from "@shopify/hydrogen";
import { Loader2 } from "lucide-react";

import { Price } from "@/components/product/price";
import { Button } from "@/components/ui/button";
import { useCart, useCheckout } from "@/lib/cart/client";

import { DiscountForm } from "./discount-form";

interface CartSummaryProps {
  cart: CartData;
}

export function CartSummary({ cart }: CartSummaryProps) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        <DiscountForm cart={cart} />
        <CartTotal cart={cart} />
      </div>
      <CartCheckout label="Mergi la plată" />
    </div>
  );
}

interface CartTotalProps {
  cart: CartData;
}

export function CartTotal({ cart }: CartTotalProps) {
  const isCostPending = useCart((state) =>
    Boolean(state.loading || state.pending.cost || state.revalidating),
  );
  const { amount, currencyCode } = cart.cost.totalAmount;
  return (
    <div
      aria-busy={isCostPending || undefined}
      aria-label="Total estimat"
      className="grid gap-1"
      role="group"
    >
      <div className="flex items-baseline justify-between text-base text-foreground">
        <span>Total estimat</span>
        {isCostPending || !currencyCode ? (
          <span className="font-medium text-muted-foreground text-xl">Se actualizează…</span>
        ) : (
          <Price amount={amount} className="font-medium text-xl" currencyCode={currencyCode} />
        )}
      </div>
      <p className="text-muted-foreground text-xs">Livrarea se calculează la plată.</p>
    </div>
  );
}

interface CartCheckoutProps {
  label?: string;
}

export function CartCheckout({ label = "Plătește" }: CartCheckoutProps) {
  const {
    checkoutError,
    checkoutErrorId,
    handleCheckout,
    isCheckingOut,
    isCheckoutDisabled,
    isUpdatingCart,
  } = useCheckout();
  return (
    <div className="grid gap-2.5">
      <Button
        aria-busy={isCheckingOut || isUpdatingCart || undefined}
        aria-describedby={checkoutError ? checkoutErrorId : undefined}
        className="h-12 w-full justify-center"
        disabled={isCheckoutDisabled}
        onClick={handleCheckout}
        type="button"
      >
        {isCheckingOut || isUpdatingCart ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {isCheckingOut ? "Te ducem la plată…" : isUpdatingCart ? "Se actualizează coșul…" : label}
      </Button>
      {checkoutError ? (
        <p className="text-xs text-destructive" id={checkoutErrorId} role="alert">
          {checkoutError}
        </p>
      ) : null}
    </div>
  );
}
