import { cn } from "cn";
import type { ComponentProps } from "react";

import { DiscountBadge } from "@/components/product/discount-badge";
import { Price } from "@/components/product/price";
import { getDiscountPercent } from "@/lib/product";

interface ProductPriceProps extends ComponentProps<"div"> {
  compareAtPrice?: number;
  /** One piece, in bani. */
  price: number;
}

export function ProductPrice({ className, compareAtPrice, price, ...props }: ProductPriceProps) {
  const discountPercent = getDiscountPercent(price, compareAtPrice);
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)} {...props}>
      <Price amount={price} className="text-xl" />
      {discountPercent && compareAtPrice ? (
        <>
          <Price amount={compareAtPrice} className="text-xl line-through text-foreground/35" />
          <DiscountBadge percent={discountPercent} />
        </>
      ) : null}
      <span className="text-sm text-muted-foreground">/ buc.</span>
    </div>
  );
}
