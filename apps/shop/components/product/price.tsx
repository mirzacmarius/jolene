import { cn } from "cn";
import type { ComponentProps } from "react";

import { formatPrice } from "@/lib/money";

interface PriceProps extends ComponentProps<"span"> {
  /** In bani. */
  amount: number;
}

export function Price({ amount, className, ...props }: PriceProps) {
  return (
    <span
      className={cn("font-mono text-xl text-foreground tabular-nums tracking-tight", className)}
      {...props}
    >
      {formatPrice(amount)}
    </span>
  );
}
