"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  type FaceName,
  faceNames,
  previewFields,
  productKindLabels,
} from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { Logo } from "@jolene/ui/logo";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import type { PreviewView } from "./design-preview";
import { PreviewStage } from "./preview-stage";

type ViewKey = "assembly" | `${string}:${FaceName}`;

/**
 * A design as whoever has its viewing link sees it: the item on the table,
 * every face of it, with the couple's details, live as the couple changes
 * it, and nothing to change here (docs/adr/0023).
 */
export function DesignView({ code }: { code: string }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const data = useQuery(api.designs.view, { code });
  const [viewKey, setViewKey] = useState<ViewKey>("assembly");
  const document = data?.document as DesignDocument | undefined;
  const fields = useMemo(
    () =>
      document && data
        ? previewFields(document.occasion, document.language, data.fields)
        : {},
    [document, data],
  );

  if (data === undefined) return <DesignViewSkeleton />;
  if (data === null || !document)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
        <Logo />
        <p className="max-w-sm text-muted-foreground">{t("view.notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/studio">{t("view.browse")}</Link>
        </Button>
      </div>
    );

  const views = [
    { value: "assembly" as ViewKey, label: t("design.together") },
    ...document.pieces.flatMap((piece) =>
      faceNames
        .filter((face) => piece[face])
        .map((face) => ({
          value: `${piece.id}:${face}` as ViewKey,
          label:
            face === "back"
              ? `${piece.name ?? piece.id} · ${t("design.backSide")}`
              : (piece.name ?? piece.id),
        })),
    ),
  ];
  const view: PreviewView =
    viewKey === "assembly"
      ? { kind: "assembly" }
      : {
          kind: "face",
          piece: viewKey.split(":")[0] as string,
          face: viewKey.split(":")[1] as FaceName,
        };
  const item = productKindLabels[document.kind][locale];
  const title = `${item} · ${data.suite[locale]}`;
  const hosts = data.hosts[locale];

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3 sm:px-4">
        <Link href="/studio" className="flex items-center gap-3">
          <Logo />
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground sm:inline">
            Studio
          </span>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl">{title}</h1>
        </div>
        {/* On a phone the title takes the room; the footer offers the same. */}
        <Button asChild size="sm" className="ml-auto hidden sm:inline-flex">
          <Link href="/studio#colectii">{t("view.yours")}</Link>
        </Button>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <p className="border-b border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground sm:px-6">
          {hosts ? t("view.from", { hosts }) : t("view.fromUnnamed")}
        </p>
        <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col bg-[radial-gradient(80%_70%_at_50%_45%,var(--color-card),var(--color-secondary))] lg:min-h-0">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="relative z-10 flex flex-wrap items-center gap-3 p-3">
              <SegmentedControl
                label={t("view.showing")}
                value={viewKey}
                onValueChange={setViewKey}
                options={views}
              />
            </div>
            <PreviewStage
              document={document}
              fields={fields}
              assets={data.assets}
              view={view}
              title={title}
            />
          </div>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-card px-4 py-3 text-sm sm:px-6">
          <p className="text-muted-foreground">{t("view.yoursLead")}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/studio#colectii">{t("view.yours")}</Link>
          </Button>
        </footer>
      </main>
    </div>
  );
}

export function DesignViewSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="h-14 border-b border-border/70" />
      <div className="flex flex-1 items-center justify-center bg-secondary/60">
        <Skeleton className="aspect-[3/4] h-2/3 rounded-xl" />
      </div>
    </div>
  );
}
