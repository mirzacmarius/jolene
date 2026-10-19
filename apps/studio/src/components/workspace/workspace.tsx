"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  type FaceName,
  faceNames,
  fieldKeysUsed,
  previewFields,
  productKindLabels,
} from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Logo } from "@jolene/ui/logo";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { cn } from "@jolene/ui/utils";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, ChevronLeft, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { DesignPreview, type PreviewView } from "../design/design-preview";
import { FieldsPanel } from "./fields-panel";
import { StylePanel } from "./style-panel";
import { useApply, useFieldDrafts, useSaving } from "./use-design";

/** The design named in the URL, once the session that owns it is known. */
export function Workspace() {
  const t = useI18n();
  const { id } = useParams<{ id: string }>();
  const { isLoading } = useConvexAuth();
  const data = useQuery(api.designs.get, isLoading ? "skip" : { designId: id });
  if (data === undefined) return <WorkspaceSkeleton />;
  if (data === null)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
        <Logo />
        <p className="max-w-sm text-muted-foreground">{t("design.notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/">{t("common.collections")}</Link>
        </Button>
      </div>
    );
  return <Editor key={data.design._id} data={data} />;
}

type DesignData = NonNullable<FunctionReturnType<typeof api.designs.get>>;

type ViewKey = "assembly" | `${string}:${FaceName}`;

function Editor({ data }: { data: DesignData }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const document = data.design.document as DesignDocument;
  const designId = data.design._id;
  const { saving, track } = useSaving();
  const apply = useApply(designId, track);
  const { values, update } = useFieldDrafts({
    eventId: data.event._id,
    occasion: data.event.occasion,
    saved: data.event.fields,
    track,
  });
  const [tab, setTab] = useState<"details" | "style">("details");
  const [viewKey, setViewKey] = useState<ViewKey>("assembly");
  const [guides, setGuides] = useState(false);

  const fields = useMemo(
    () => previewFields(document.occasion, document.language, values),
    [document.occasion, document.language, values],
  );
  const used = useMemo(() => fieldKeysUsed(document), [document]);

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
          guides,
        };
  const title = `${productKindLabels[document.kind][locale]} · ${data.template.suite.name[locale]}`;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3 sm:px-4">
        <Button asChild variant="ghost" size="sm" className="gap-1 px-2.5">
          <Link href={`/colectii/${data.template.suite.slug}`}>
            <ChevronLeft aria-hidden />
            <span className="hidden sm:inline">
              {t("design.back", { suite: data.template.suite.name[locale] })}
            </span>
          </Link>
        </Button>
        <h1 className="truncate font-display text-xl">{title}</h1>
        <span
          className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex"
          aria-live="polite"
        >
          {saving ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="size-3.5" aria-hidden />
          )}
          {saving ? t("design.saving") : t("design.saved")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            className="hidden sm:inline-flex"
          >
            <Sparkles aria-hidden />
            {t("design.ai")}
            <Badge variant="gold">{t("common.soon")}</Badge>
          </Button>
          <Button size="sm" disabled title={t("design.orderSoon")}>
            {t("design.order")}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex min-h-[60vh] min-w-0 flex-1 flex-col bg-[radial-gradient(80%_70%_at_50%_45%,var(--color-card),var(--color-secondary))] lg:order-2 lg:min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
            <SegmentedControl
              label={t("design.together")}
              value={viewKey}
              onValueChange={setViewKey}
              options={views}
            />
            {viewKey !== "assembly" ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={guides}
                  onChange={(event) => setGuides(event.target.checked)}
                  className="size-3.5 accent-[var(--color-primary)]"
                />
                {t("design.guides")}
              </label>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 px-6 pb-8 sm:px-12">
            <DesignPreview
              document={document}
              fields={fields}
              assets={data.assets}
              view={view}
              title={title}
              className="size-full drop-shadow-[0_18px_30px_rgba(43,38,32,0.12)]"
            />
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col border-border/70 bg-card lg:order-1 lg:w-[380px] lg:border-r">
          <div className="border-b border-border/70 p-3">
            <SegmentedControl
              label={t("design.details")}
              value={tab}
              onValueChange={setTab}
              options={[
                { value: "details", label: t("design.details") },
                { value: "style", label: t("design.style") },
              ]}
              className="w-full [&>*]:flex-1"
            />
          </div>
          <div className={cn("flex-1 overflow-y-auto p-5")}>
            {tab === "details" ? (
              <FieldsPanel
                occasion={document.occasion}
                used={used}
                language={document.language}
                values={values}
                onChange={update}
              />
            ) : (
              <StylePanel document={document} apply={apply} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="h-14 border-b border-border/70" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[380px] space-y-4 border-r border-border/70 p-5 lg:block">
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-14" />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center bg-secondary/60">
          <Skeleton className="aspect-[3/4] h-2/3 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
