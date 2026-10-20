"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import {
  type DesignDocument,
  type Fields,
  previewFields,
  productKindLabels,
} from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { toast } from "@jolene/ui/toaster";
import { cn } from "@jolene/ui/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Hourglass, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useAnswerRendering } from "../ai/rendering";
import { DesignPreview } from "../design/design-preview";

type Progress = FunctionReturnType<typeof api.simple.progress>[number];

/** What an item's state reads as, or nothing while there is nothing to say. */
function stateOf(progress: Progress | undefined) {
  switch (progress?.status) {
    case "waiting":
      return "waiting";
    case "pending":
    case "streaming":
    case "rendering":
      return "writing";
    case "done":
      if (!progress.composed) return undefined;
      return progress.wrote ? "written" : "unchanged";
    case "stopped":
      return progress.composed ? "stopped" : undefined;
    case "failed":
      return "failed";
    default:
      return undefined;
  }
}

/**
 * Simple mode's view of the whole collection, under the design: the event's
 * designs from it, small, each with where the AI designer stands on it, and
 * each a link to its own workspace. It also shows the AI designer any of
 * them it asks to see while it writes them.
 */
export function SuiteStrip({
  designId,
  values,
}: {
  /** The design open here. */
  designId: Id<"designs">;
  /** The couple's details as typed here. */
  values: Fields;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const collection = useQuery(api.simple.collection, { designId });
  const designIds = useMemo(
    () => collection?.designs.map((design) => design._id),
    [collection],
  );
  const progress = useQuery(
    api.simple.progress,
    designIds && designIds.length > 0 ? { designIds } : "skip",
  );
  const retry = useMutation(api.ai.retry);
  const answer = useAnswerRendering();

  // A reply that asks to see its item is shown it whole, as it arrives, once
  // its revision has reached here.
  const details = useRef(values);
  useEffect(() => {
    details.current = values;
  });
  useEffect(() => {
    if (!collection || !progress) return;
    for (const entry of progress) {
      const design = collection.designs.find(
        (each) => each._id === entry.designId,
      );
      if (
        entry.status !== "rendering" ||
        !entry.rendering ||
        !design ||
        design.revision < entry.rendering.revision
      )
        continue;
      const document = design.document as DesignDocument;
      void answer(
        { messageId: entry.replyId, toolUseId: entry.rendering.toolUseId },
        {
          design: document,
          fields: previewFields(
            document.occasion,
            document.language,
            details.current,
          ),
          assets: collection.assets,
          view: { kind: "assembly" },
          revision: design.revision,
        },
      );
    }
  }, [collection, progress, answer]);

  if (!collection || collection.designs.length < 2) return null;
  const states = new Map(progress?.map((entry) => [entry.designId, entry]));
  return (
    <nav
      aria-label={t("simple.strip.label")}
      className="shrink-0 border-t border-border/60 bg-background/50"
    >
      <ol className="flex gap-1.5 overflow-x-auto px-3 py-2.5">
        {collection.designs.map((design) => {
          const document = design.document as DesignDocument;
          const entry = states.get(design._id);
          const state = stateOf(entry);
          const label = productKindLabels[design.kind][locale];
          const here = design._id === designId;
          return (
            <li
              key={design._id}
              className="flex shrink-0 flex-col items-center"
            >
              <Link
                href={`/studio/design/${design._id}`}
                aria-current={here ? "page" : undefined}
                className={cn(
                  "flex w-24 flex-col items-center gap-1 rounded-xl px-1.5 pt-1.5 pb-1 text-center outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  here ? "bg-card shadow-sm" : "hover:bg-card/70",
                )}
              >
                <span className="relative block h-16 w-full">
                  <DesignPreview
                    document={document}
                    fields={previewFields(
                      document.occasion,
                      document.language,
                      values,
                    )}
                    assets={collection.assets}
                    className="size-full"
                  />
                  {state ? (
                    <span
                      className={cn(
                        "absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border border-border/70 bg-card shadow-sm",
                        state === "failed" && "text-destructive",
                        state === "written" && "text-gold",
                      )}
                      aria-hidden
                    >
                      {state === "waiting" ? (
                        <Hourglass className="size-3" />
                      ) : state === "writing" ? (
                        <LoaderCircle className="size-3 animate-spin" />
                      ) : state === "written" ? (
                        <Check className="size-3" />
                      ) : state === "failed" ? (
                        <RotateCcw className="size-3" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-muted-foreground" />
                      )}
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 text-[11px] leading-tight font-medium">
                  {label}
                </span>
                <span
                  className={cn(
                    "min-h-3.5 text-[10px] leading-tight",
                    state === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                  aria-live="polite"
                >
                  {state ? (
                    <>
                      <span className="sr-only">{label}: </span>
                      {t(`simple.strip.${state}`)}
                    </>
                  ) : null}
                </span>
              </Link>
              {state === "failed" && entry?.canRetry ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-0.5 h-6 px-2 text-[11px]"
                  onClick={() =>
                    void retry({ messageId: entry.replyId }).catch(() =>
                      toast.error(t("common.error")),
                    )
                  }
                >
                  {t("simple.strip.retry")}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
