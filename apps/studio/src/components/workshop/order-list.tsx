"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useI18n } from "@/locales/client";
import { useFormats } from "./formats";

/** How many orders the list shows at first, and adds each time. */
const PAGE_SIZE = 25;

/** The orders, newest first: each opens on its own page. */
export function OrderList() {
  const t = useI18n();
  const format = useFormats();
  const { results, status, loadMore } = usePaginatedQuery(
    api.workshop.orders,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  if (status === "LoadingFirstPage")
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  if (results.length === 0)
    return (
      <p className="rounded-3xl border border-dashed p-10 text-muted-foreground">
        {t("workshop.empty")}
      </p>
    );
  return (
    <div className="flex flex-col items-start gap-6">
      <ol className="w-full divide-y overflow-hidden rounded-3xl border bg-card">
        {results.map((order) => (
          <li key={order.number}>
            <Link
              href={`/studio/atelier/${order.name}`}
              className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:gap-6"
            >
              <span className="flex items-center gap-2 sm:w-36 sm:shrink-0">
                <span className="font-display text-2xl">{order.name}</span>
                {order.test ? (
                  <Badge variant="outline">{t("workshop.test")}</Badge>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {[
                    order.customer,
                    order.pickup ? t("workshop.pickup") : order.city,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {order.lines
                    .map((line) => `${line.title} × ${line.quantity}`)
                    .join(", ")}
                </span>
              </span>
              <span className="text-sm text-muted-foreground sm:text-right">
                <time dateTime={new Date(order.paidAt).toISOString()}>
                  {format.time(order.paidAt)}
                </time>
                <span className="block font-medium text-foreground">
                  {format.lei(order.total)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          {t("workshop.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
