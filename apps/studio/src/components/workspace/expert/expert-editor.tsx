"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  type FaceName,
  type FaceRef,
  type Fields,
  faceNames,
  type Layer,
  type LayerChanges,
  type Piece,
} from "@jolene/design";
import { type RenderContext, useCanvasMeasure } from "@jolene/design/react";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@jolene/ui/segmented-control";
import { Tooltip, TooltipProvider } from "@jolene/ui/tooltip";
import { cn } from "@jolene/ui/utils";
import { useQuery } from "convex/react";
import { Layers, Redo2, Undo2 } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/locales/client";
import { type AssetLink, useAssetResolver } from "../../design/design-preview";
import { PreviewStage } from "../../design/preview-stage";
import { StylePanel } from "../style-panel";
import { Canvas } from "./canvas";
import { Inspector } from "./inspector/inspector";
import type { TextFocus } from "./inspector/text-section";
import { useShortcutLabel } from "./keyboard";
import { LayersPanel } from "./layers-panel";
import type { History } from "./use-history";

/** "assembly", or one face of one piece as "piece:face". */
function faceOf(key: string): { piece: string; face: FaceName } | null {
  const [piece, face] = key.split(":");
  return piece && face && (faceNames as readonly string[]).includes(face)
    ? { piece, face: face as FaceName }
    : null;
}

const NO_PREVIEW: ReadonlyMap<string, LayerChanges> = new Map();
const NO_LAYERS: readonly Layer[] = [];

/** What expert mode's side panel shows. */
export type ExpertPanel = "layers" | "details" | "finishes";

/**
 * Expert mode: the face's layers on the left, the canvas in the middle, the
 * inspector on the right. The view switcher stays above the canvas: the
 * assembly is a preview, and each face is edited on its own.
 */
export function ExpertEditor<K extends string>({
  document,
  fields,
  assets,
  suite,
  history,
  title,
  views,
  viewKey,
  onViewChange,
  details,
  finishes,
  ordered,
  orderedCorners,
  panel: chosen,
  onPanelChange,
  inspector: showInspector = true,
  className,
}: {
  document: DesignDocument;
  /** The couple's details, with examples where they're empty. */
  fields: Fields;
  assets: readonly AssetLink[] | undefined;
  /** The collection's slug, for its artwork. */
  suite: string;
  history: History;
  title: string;
  views: readonly SegmentedOption<K>[];
  viewKey: K;
  onViewChange: (key: K) => void;
  /** The couple's details panel, as simple mode shows it. */
  details: ReactNode;
  /** The Finisaje tab, as simple mode shows it, while the shop sells the design. */
  finishes?: ReactNode;
  /**
   * The shop sells the design, or may: the Finisaje tab picks its paper and
   * wax, which the inspector doesn't ask again.
   */
  ordered: boolean;
  /** Its product's order options pick the corners too, on the Finisaje tab. */
  orderedCorners: boolean;
  /** What the side panel shows: the face's layers, the details or Finisaje. */
  panel: ExpertPanel;
  onPanelChange: (panel: ExpertPanel) => void;
  /** False while the AI designer's sheet stands where the inspector is. */
  inspector?: boolean;
  className?: string;
}) {
  const t = useI18n();
  const shortcut = useShortcutLabel();
  const shown = faceOf(viewKey);
  const piece: Piece | undefined = shown
    ? document.pieces.find((candidate) => candidate.id === shown.piece)
    : undefined;
  const face = shown && piece?.[shown.face] ? shown.face : null;
  const layers = (piece && face && piece[face]?.layers) || NO_LAYERS;
  const pieceId = piece?.id;
  const target = useMemo<FaceRef | null>(
    () => (pieceId && face ? { piece: pieceId, face } : null),
    [pieceId, face],
  );

  const panel = chosen === "finishes" && !finishes ? "layers" : chosen;
  const [guides, setGuides] = useState(true);
  // The selection belongs to the face it was made on.
  const [selected, setSelected] = useState<{ view: string; ids: string[] }>({
    view: viewKey,
    ids: [],
  });
  const selection = useMemo(
    () =>
      selected.view === viewKey
        ? selected.ids.filter((id) => layers.some((layer) => layer.id === id))
        : [],
    [selected, viewKey, layers],
  );
  const select = useCallback(
    (ids: string[]) => setSelected({ view: viewKey, ids }),
    [viewKey],
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [preview, setPreview] =
    useState<ReadonlyMap<string, LayerChanges>>(NO_PREVIEW);
  const onPreview = useCallback(
    (id: string, changes: LayerChanges | null) =>
      setPreview((current) => {
        if (!changes && !current.has(id)) return current;
        const next = new Map(current);
        if (changes) next.set(id, changes);
        else next.delete(id);
        return next.size === 0 ? NO_PREVIEW : next;
      }),
    [],
  );
  // Another layer, or none, starts the inspector from its top.
  const inspector = useRef<HTMLElement>(null);
  const inspected = `${viewKey} ${selection.join(" ")}`;
  useLayoutEffect(() => {
    inspector.current?.scrollTo({ top: 0 });
  }, [inspected]);
  const [focus, setFocus] = useState<TextFocus | null>(null);
  const editText = useCallback(
    (id: string, selectAll = false) => {
      select([id]);
      setFocus((current) => ({
        id,
        select: selectAll,
        n: (current?.n ?? 0) + 1,
      }));
    },
    [select],
  );
  // A new text layer opens with its words selected, to type over them.
  const onAdded = useCallback(
    (id: string, kind: "text" | "other") =>
      kind === "text" ? editText(id, true) : select([id]),
    [editText, select],
  );

  // Expert mode opens on a face to edit rather than the assembly.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const first = views.find((view) => faceOf(view.value));
    if (viewKey === "assembly" && first) onViewChange(first.value);
  }, [viewKey, views, onViewChange]);

  const artwork = useQuery(api.catalog.artwork, { slug: suite });
  // The collection's artwork resolves too, so a picture swapped in or added
  // shows at once, before the design's own list catches up.
  const allAssets = useMemo(
    () => [...(artwork ?? []), ...(assets ?? [])],
    [artwork, assets],
  );
  const resolve = useAssetResolver(allAssets);
  const measure = useCanvasMeasure();
  const context = useMemo<RenderContext>(
    () => ({ fields, assets: resolve, measure }),
    [fields, resolve, measure],
  );

  return (
    <TooltipProvider>
      <div className={cn("flex min-h-0 flex-1", className)}>
        <aside className="flex w-60 shrink-0 flex-col border-r border-border/70 bg-card xl:w-72">
          <div className="border-b border-border/70 p-3">
            <SegmentedControl
              label={t("expert.panels")}
              value={panel}
              onValueChange={onPanelChange}
              options={[
                { value: "layers", label: t("expert.layers.title") },
                { value: "details", label: t("design.details") },
                ...(finishes
                  ? [{ value: "finishes" as const, label: t("finishes.tab") }]
                  : []),
              ]}
              className="w-full [&>*]:flex-1"
            />
          </div>
          {panel === "details" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{details}</div>
          ) : panel === "finishes" ? (
            finishes
          ) : piece && target ? (
            <LayersPanel
              document={document}
              piece={piece}
              target={target}
              selection={selection}
              onSelect={select}
              hovered={hovered}
              onHover={setHovered}
              apply={history.apply}
              artwork={artwork}
              onAdded={onAdded}
            />
          ) : (
            <div className="space-y-3 p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("expert.assembly.lead")}
              </p>
              <div className="grid gap-1.5">
                {views
                  .filter((view) => faceOf(view.value))
                  .map((view) => (
                    <button
                      key={view.value}
                      type="button"
                      onClick={() => onViewChange(view.value)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-[13px] outline-none transition hover:border-foreground/20 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <Layers
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                      {view.label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(80%_70%_at_50%_45%,var(--color-card),var(--color-secondary))]">
          <div className="flex items-center gap-3 border-b border-border/50 px-3 py-2">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <SegmentedControl
                label={t("expert.views")}
                value={viewKey}
                onValueChange={onViewChange}
                options={views}
              />
            </div>
            {face ? (
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={guides}
                  onChange={(event) => setGuides(event.target.checked)}
                  className="size-3.5 accent-[var(--color-primary)]"
                />
                {t("design.guides")}
              </label>
            ) : null}
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip
                label={t("expert.history.undo")}
                shortcut={shortcut("Z")}
              >
                <button
                  type="button"
                  onClick={history.undo}
                  disabled={!history.canUndo}
                  aria-label={t("expert.history.undo")}
                  className={toolbarButton}
                >
                  <Undo2 aria-hidden />
                </button>
              </Tooltip>
              <Tooltip
                label={t("expert.history.redo")}
                shortcut={shortcut("Z", { shift: true })}
              >
                <button
                  type="button"
                  onClick={history.redo}
                  disabled={!history.canRedo}
                  aria-label={t("expert.history.redo")}
                  className={toolbarButton}
                >
                  <Redo2 aria-hidden />
                </button>
              </Tooltip>
            </div>
          </div>
          {piece && face ? (
            <Canvas
              document={document}
              piece={piece}
              face={face}
              context={context}
              guides={guides}
              title={title}
              selection={selection}
              onSelect={select}
              hovered={hovered}
              onHover={setHovered}
              preview={preview}
              apply={history.apply}
              onEditText={(id) => editText(id)}
            />
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col pt-6">
              <PreviewStage
                document={document}
                fields={fields}
                assets={allAssets}
                view={{ kind: "assembly" }}
                title={title}
              />
            </div>
          )}
        </section>

        <aside
          ref={inspector}
          className={cn(
            "w-72 shrink-0 overflow-y-auto border-l border-border/70 bg-card xl:w-80",
            !showInspector && "hidden",
          )}
          aria-label={t("expert.inspector")}
        >
          {piece && face ? (
            <Inspector
              document={document}
              piece={piece}
              face={face}
              ordered={ordered}
              orderedCorners={orderedCorners}
              selection={selection}
              onSelect={select}
              fields={fields}
              artwork={artwork}
              resolve={resolve}
              apply={history.apply}
              onPreview={onPreview}
              focus={focus}
            />
          ) : (
            <div className="p-5">
              <StylePanel
                document={document}
                apply={history.apply}
                ordered={ordered}
              />
            </div>
          )}
        </aside>
      </div>
    </TooltipProvider>
  );
}

const toolbarButton =
  "flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4";
