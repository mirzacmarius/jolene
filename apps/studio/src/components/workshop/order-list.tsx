"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/locales/client";
import { useFormats } from "./formats";
import { StatusBadge } from "./status-badge";

/** How many orders the list shows at first, and adds each time. */
const PAGE_SIZE = 25;

/** The list's tabs: every order, or those with one status. */
const TABS = [
  "all",
  "paid",
  "making",
  "sent",
  "ready",
  "done",
  "cancelled",
] as const;

type Tab = (typeof TABS)[number];

/** The orders, newest first, all or by status: each opens on its own page. */
export function OrderList() {
  const t = useI18n();
  const [tab, setTab] = useState<Tab>("all");
  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <SegmentedControl
          value={tab}
          onValueChange={setTab}
          options={TABS.map((value) => ({
            value,
            label: t(`workshop.tabs.${value}`),
          }))}
          label={t("workshop.show")}
          className="w-max"
        />
      </div>
      <Orders tab={tab} />
    </div>
  );
}

function Orders({ tab }: { tab: Tab }) {
  const t = useI18n();
  const format = useFormats();
  const { results, status, loadMore } = usePaginatedQuery(
    api.workshop.orders,
    tab === "all" ? {} : { status: tab },
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
        {tab === "all" ? t("workshop.empty") : t("workshop.noneHere")}
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
              <span className="flex flex-wrap items-center gap-2 sm:w-56 sm:shrink-0">
                <span className="font-display text-2xl">{order.name}</span>
                <StatusBadge status={order.status} />
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
