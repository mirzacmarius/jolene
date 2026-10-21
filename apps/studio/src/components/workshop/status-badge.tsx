"use client";

import type { OrderStatus } from "@jolene/backend/convex/orders/status";
import { Badge } from "@jolene/ui/badge";
import { useI18n } from "@/locales/client";

/**
 * Where an order is: paid ones stand out, as the next to start, and finished
 * or cancelled ones step back.
 */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useI18n();
  return (
    <Badge
      variant={
        status === "paid"
          ? "gold"
          : status === "done" || status === "cancelled"
            ? "outline"
            : "default"
      }
      className={
        status === "cancelled"
          ? "border-destructive/40 text-destructive"
          : undefined
      }
    >
      {t(`workshop.statuses.${status}`)}
    </Badge>
  );
}
