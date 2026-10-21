"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Badge } from "@jolene/ui/badge";
import { Skeleton } from "@jolene/ui/skeleton";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useI18n } from "@/locales/client";
import { useAsks } from "./asks";

/**
 * The shop's order options by name, each with what it asks and how many
 * products ask it. Those of one name follow each other, told apart by their
 * choices and prices. Each opens on its own page.
 */
export function LineOptionList() {
  const t = useI18n();
  const asks = useAsks();
  const options = useQuery(api.workshop.lineOptions.list);
  if (options === undefined)
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  return (
    <ol className="divide-y overflow-hidden rounded-3xl border bg-card">
      {options.map((option) => (
        <li key={option.handle}>
          <Link
            href={`/studio/atelier/optiuni/${encodeURIComponent(option.handle)}`}
            className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-secondary/50"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{option.label}</span>
                {option.required ? (
                  <Badge variant="outline">
                    {t("workshop.catalog.required")}
                  </Badge>
                ) : null}
                {option.editedAt !== null ? (
                  <Badge variant="outline">
                    {t("workshop.lineOptions.edited")}
                  </Badge>
                ) : null}
              </span>
              <span className="line-clamp-2 text-sm text-muted-foreground">
                {asks(option)}
              </span>
            </span>
            <span className="shrink-0 text-right text-sm text-muted-foreground">
              {t("workshop.lineOptions.askedBy", { count: option.askedBy })}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
