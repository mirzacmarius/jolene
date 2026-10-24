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
import { Button } from "@jolene/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@jolene/ui/dialog";
import { Logo } from "@jolene/ui/logo";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { cn } from "@jolene/ui/utils";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, ChevronLeft, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { orderOf, picksCorners } from "@/lib/finishes";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { AiDesigner } from "../ai/ai-designer";
import type { PreviewView } from "../design/design-preview";
import { usePreviewMode } from "../design/preview-mode";
import { PreviewStage } from "../design/preview-stage";
import { ViewLink } from "../design/view-link";
import { ProofOrder } from "../proof/proof-order";
import { GuidedStart } from "../simple/guided-start";
import { SuiteStrip } from "../simple/suite-strip";
import { usePrice } from "../suite/use-price";
import { ExpertEditor, type ExpertPanel } from "./expert/expert-editor";
import { ModeSwitch } from "./expert/mode-switch";
import { useHistory } from "./expert/use-history";
import { useDesignMode } from "./expert/use-mode";
import { FieldsPanel } from "./fields-panel";
import { FinishesPanel } from "./finishes-panel";
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
          <Link href="/studio">{t("common.collections")}</Link>
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
  const price = usePrice();
  const document = data.design.document as DesignDocument;
  const designId = data.design._id;
  const { saving, track } = useSaving();
  const apply = useApply(designId, track);
  // Every change made in this tab goes through the history, to undo it.
  const history = useHistory(document, apply);
  const { mode, choose } = useDesignMode();
  const { values, update } = useFieldDrafts({
    eventId: data.event._id,
    occasion: data.event.occasion,
    saved: data.event.fields,
    track,
  });
  const [tab, setTab] = useState<"details" | "style" | "finishes">("details");
  const [expertPanel, setExpertPanel] = useState<ExpertPanel>("layers");
  const [viewKey, setViewKey] = useState<ViewKey>("assembly");
  const [guides, setGuides] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // The order's sheet: the proof beside the order, to approve and add.
  const [ordering, setOrdering] = useState(false);
  const [previewMode] = usePreviewMode();

  const fields = useMemo(
    () => previewFields(document.occasion, document.language, values),
    [document.occasion, document.language, values],
  );
  const used = useMemo(() => fieldKeysUsed(document), [document]);

  // The product the design is ordered as, while the shop sells it: its picks
  // are on the Finisaje tab, and what they come to on the Order button.
  const product = useQuery(api.catalog.product, {
    template: data.template.slug,
  });
  const finishes = data.design.finishes;
  const order = useMemo(
    () => (product ? orderOf(document, product, finishes) : null),
    [document, product, finishes],
  );
  const panel = tab === "finishes" && !product ? "details" : tab;
  // What the Finisaje tab picks, only it asks: the paper and the wax while
  // the shop sells the design, and the corners when its order options do
  // (ADR 0021). A product still loading counts as sold, so no panel shows a
  // choice only to take it away.
  const ordered = product !== null;
  const orderedCorners =
    product === undefined || (product !== null && picksCorners(product));

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
  const details = (
    <FieldsPanel
      occasion={document.occasion}
      used={used}
      language={document.language}
      values={values}
      onChange={update}
    />
  );
  const finishesPanel =
    product && order ? (
      <FinishesPanel
        designId={designId}
        eventId={data.event._id}
        kind={document.kind}
        document={document}
        product={product}
        order={order}
        apply={history.apply}
        track={track}
      />
    ) : null;

  return (
    <div className="flex min-h-dvh flex-col max-lg:pb-(--ai-sheet-height) lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3 sm:px-4">
        <Button asChild variant="ghost" size="sm" className="gap-1 px-2.5">
          <Link href={`/studio/colectii/${data.template.suite.slug}`}>
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
          <ModeSwitch mode={mode} onChange={choose} />
          <ViewLink
            designId={designId}
            revision={data.design.revision}
            code={data.design.viewCode}
            pictured={data.design.viewImageDrawn}
            document={document}
            fields={fields}
            assets={data.assets}
          />
          <AiDesigner
            designId={designId}
            revision={data.design.revision}
            design={document}
            fields={fields}
            assets={data.assets}
            view={view}
            onOpenChange={setAiOpen}
          />
          <Dialog open={ordering} onOpenChange={setOrdering}>
            <DialogTrigger asChild>
              <Button size="sm">
                {t("design.order")}
                {order ? (
                  <>
                    <span
                      className="hidden h-4 w-px bg-primary-foreground/35 sm:block"
                      aria-hidden
                    />
                    <span className="hidden font-semibold sm:inline">
                      {price(order.total)}
                    </span>
                  </>
                ) : null}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1060px]">
              <ProofOrder
                data={data}
                sheet
                onBack={() => setOrdering(false)}
                onFinishes={() => {
                  setOrdering(false);
                  if (mode === "expert") setExpertPanel("finishes");
                  else setTab("finishes");
                }}
              />
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3"
                  aria-label={t("proof.close")}
                >
                  <X aria-hidden />
                </Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {mode === "expert" ? (
        <ExpertEditor
          document={document}
          fields={fields}
          assets={data.assets}
          suite={data.template.suite.slug}
          history={history}
          title={title}
          views={views}
          viewKey={viewKey}
          onViewChange={setViewKey}
          details={details}
          finishes={finishesPanel}
          ordered={ordered}
          orderedCorners={orderedCorners}
          panel={expertPanel}
          onPanelChange={setExpertPanel}
          inspector={!aiOpen}
          className="lg:pr-(--ai-sheet-width)"
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:pr-(--ai-sheet-width)">
          <section className="flex min-h-[60vh] min-w-0 flex-1 flex-col bg-[radial-gradient(80%_70%_at_50%_45%,var(--color-card),var(--color-secondary))] lg:order-2 lg:min-h-0">
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 p-3">
                <SegmentedControl
                  label={t("design.together")}
                  value={viewKey}
                  onValueChange={setViewKey}
                  options={views}
                />
                {viewKey !== "assembly" && previewMode === "flat" ? (
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
              <PreviewStage
                document={document}
                fields={fields}
                assets={data.assets}
                view={view}
                title={title}
              />
            </div>
            <SuiteStrip designId={designId} values={values} />
          </section>

          <aside className="flex w-full shrink-0 flex-col border-border/70 bg-card lg:order-1 lg:w-[380px] lg:border-r">
            <div className="border-b border-border/70 p-3">
              <SegmentedControl
                label={t("design.details")}
                value={panel}
                onValueChange={setTab}
                options={[
                  { value: "details", label: t("design.details") },
                  { value: "style", label: t("design.style") },
                  ...(product
                    ? [{ value: "finishes" as const, label: t("finishes.tab") }]
                    : []),
                ]}
                className="w-full [&>*]:flex-1"
              />
            </div>
            {panel === "finishes" && finishesPanel ? (
              finishesPanel
            ) : (
              <div className={cn("flex-1 overflow-y-auto p-5")}>
                {panel === "details" ? (
                  <GuidedStart data={data} values={values} onChange={update}>
                    {details}
                  </GuidedStart>
                ) : (
                  <StylePanel
                    document={document}
                    apply={history.apply}
                    ordered={ordered}
                  />
                )}
              </div>
            )}
          </aside>
        </div>
      )}
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
