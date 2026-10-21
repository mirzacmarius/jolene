"use client";

import { HandbagIcon } from "lucide-react";

import { useCart, useCartDrawer } from "@/lib/cart/client";

interface CartIconClientProps {
  cartLabel: string;
  initialCount: number;
}

// Pieces run into the hundreds, so the badge counts products ordered, not pieces.
export function CartIconClient({ cartLabel, initialCount }: CartIconClientProps) {
  const { cart, isLoading } = useCart();
  const drawer = useCartDrawer();
  const count = isLoading ? initialCount : (cart?.count ?? 0);

  return (
    <button
      className="flex cursor-pointer items-center justify-center gap-1.5 text-foreground transition-colors hover:text-foreground/80"
      onClick={drawer.open}
      type="button"
    >
      <span className="relative">
        <HandbagIcon className="size-5" />
        {count > 0 ? (
          <span className="absolute -top-2 -right-1 flex size-4 items-center justify-center rounded-full bg-foreground text-xxs leading-none text-background">
            {count}
          </span>
        ) : null}
      </span>
      <span className="sr-only">{cartLabel}</span>
    </button>
  );
}
