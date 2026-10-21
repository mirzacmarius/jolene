"use client";

import type { Box, DesignDocument, Fields } from "@jolene/design";
import {
  fitBox,
  grainMm,
  lifelikeFrame,
  mostZoom,
  type Size,
  tabletopColor,
  useGrains,
} from "@jolene/design/react";
import { Button } from "@jolene/ui/button";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { cn } from "@jolene/ui/utils";
import { Shrink, ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useI18n } from "@/locales/client";
import {
  type AssetLink,
  DesignPreview,
  type PreviewView,
} from "./design-preview";
import { usePreviewMode } from "./preview-mode";
import { useCamera } from "./use-camera";
import { useLight } from "./use-light";

/** How far each zoom button zooms. */
const ZOOM_STEP = 1.6;

/**
 * Daylight falling across the table from the top left, and the gentle
 * darkening of a photograph towards its corners.
 */
const DAYLIGHT =
  "radial-gradient(120% 90% at 25% 15%, rgb(255 250 240 / 0.16), rgb(255 250 240 / 0) 55%), radial-gradient(140% 120% at 50% 45%, rgb(40 30 20 / 0) 55%, rgb(40 30 20 / 0.14))";

/** The stage's size and the room the item has on it, in CSS pixels. */
interface Space {
  stage: Size;
  area: Box;
  /** Device pixels to the CSS pixel. */
  density: number;
}

const sameSpace = (a: Space, b: Space) =>
  a.density === b.density &&
  a.stage.width === b.stage.width &&
  a.stage.height === b.stage.height &&
  a.area.x === b.area.x &&
  a.area.y === b.area.y &&
  a.area.width === b.area.width &&
  a.area.height === b.area.height;

/**
 * A screen density in steps of about a fifth, so the views redraw their
 * grain and light for a real change of zoom and not for every pixel of a
 * resize.
 */
export const densityStep = (value: number) =>
  2 ** (Math.round(Math.log2(value) * 4) / 4);

/**
 * The linen the item lies on, its weave as fine as the screen shows it. It
 * follows the tiles itself, so a tile arriving redraws the cloth alone.
 */
export function Tablecloth({
  color,
  pixelsPerMm,
  perMm,
  origin,
}: {
  color: string;
  /** Device pixels to the millimetre, for the weave's detail. */
  pixelsPerMm: number | undefined;
  /** CSS pixels to the millimetre, for the weave's size. */
  perMm: number;
  /** Where the weave starts, under the item's corner. */
  origin: Box | null;
}) {
  const cloth = useGrains(["cloth"], pixelsPerMm)("cloth");
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundColor: color,
        backgroundImage: cloth ? `url(${cloth})` : undefined,
        backgroundSize: `${grainMm("cloth") * perMm}px`,
        backgroundPosition: origin ? `${origin.x}px ${origin.y}px` : undefined,
      }}
    />
  );
}

/** Whether a media query matches, kept up to date; false on the server. */
function useMedia(query: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * The workspace's preview: the design lying on a table, lifelike, or flat as
 * it prints. It follows the pointer with the light and a slight lean, unless
 * the visitor asks for less motion, and zooms in for a closer look with the
 * buttons, Ctrl or Cmd with the wheel, a pinch or a double click. It fills
 * the positioned element it's placed in, under that element's other
 * contents, and its item sits in the room left below them.
 */
export function PreviewStage({
  document,
  fields,
  assets,
  view,
  title,
}: {
  document: DesignDocument;
  fields: Fields;
  assets: readonly AssetLink[] | undefined;
  view: PreviewView;
  title?: string;
}) {
  const t = useI18n();
  const [mode, setMode] = usePreviewMode();
  const lifelike = mode === "lifelike";
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const hover = useMedia("(hover: hover) and (pointer: fine)");

  const stage = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const item = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);

  const [space, setSpace] = useState<Space | null>(null);
  useLayoutEffect(() => {
    const outer = stage.current;
    const inner = room.current;
    if (!outer || !inner) return;
    const measure = () => {
      const s = outer.getBoundingClientRect();
      const r = inner.getBoundingClientRect();
      const next: Space = {
        stage: { width: s.width, height: s.height },
        area: {
          x: r.left - s.left,
          y: r.top - s.top,
          width: r.width,
          height: r.height,
        },
        density: window.devicePixelRatio || 1,
      };
      setSpace((current) =>
        current && sameSpace(current, next) ? current : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const frame = lifelikeFrame(
    document,
    view.kind === "assembly" ? view : { kind: "face", piece: view.piece },
  );
  const fitted = space ? fitBox(frame.width / frame.height, space.area) : null;
  /** CSS pixels to the millimetre with the whole item in view. */
  const perMm = fitted ? fitted.width / frame.width : 0;
  const box = lifelike ? fitted : (space?.area ?? null);

  const most = mostZoom(perMm);
  const { zoom, zoomBy, showAll } = useCamera({
    stage,
    table,
    size: space?.stage ?? null,
    most,
    anchor: space
      ? {
          x: space.area.x + space.area.width / 2,
          y: space.area.y + space.area.height / 2,
        }
      : { x: 0, y: 0 },
    still,
  });
  const pixelsPerMm =
    space && perMm > 0 ? densityStep(perMm * zoom * space.density) : undefined;

  const viewKey =
    view.kind === "assembly" ? "assembly" : `${view.piece}:${view.face}`;
  // A new view starts whole.
  useEffect(() => showAll(false), [viewKey, showAll]);

  const leans = lifelike && !still && hover && zoom === 1;
  useLight({
    stage,
    item,
    tilt,
    follow: lifelike && !still,
    lean: leans,
    sweep: viewKey,
  });

  return (
    <>
      <div
        ref={stage}
        className={cn(
          "absolute inset-0 touch-pan-y overflow-hidden select-none",
          zoom > 1 && "cursor-grab touch-none",
        )}
      >
        <div ref={table} className="absolute inset-0">
          {lifelike ? (
            <Tablecloth
              color={tabletopColor(document.theme.palette)}
              pixelsPerMm={pixelsPerMm}
              perMm={perMm}
              origin={fitted}
            />
          ) : null}
          {box ? (
            <div
              ref={item}
              className="absolute"
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
              }}
            >
              <div
                ref={tilt}
                className="size-full"
                style={leans ? { willChange: "transform" } : undefined}
              >
                <DesignPreview
                  document={document}
                  fields={fields}
                  assets={assets}
                  view={view}
                  lifelike={lifelike}
                  pixelsPerMm={pixelsPerMm}
                  title={title}
                  className={cn(
                    "size-full",
                    !lifelike &&
                      "drop-shadow-[0_18px_30px_rgba(43,38,32,0.12)]",
                  )}
                />
              </div>
            </div>
          ) : null}
        </div>
        {lifelike ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: DAYLIGHT }}
          />
        ) : null}
      </div>

      <div className="pointer-events-none relative min-h-0 flex-1">
        <div
          ref={room}
          className="absolute inset-x-4 top-0 bottom-12 sm:inset-x-10"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2 px-3">
        <SegmentedControl
          label={t("preview.showing")}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "lifelike", label: t("preview.lifelike") },
            { value: "flat", label: t("preview.flat") },
          ]}
          className="pointer-events-auto shadow-sm"
        />
        <fieldset
          aria-label={t("preview.zoom")}
          className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full bg-secondary p-1 shadow-sm"
        >
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={zoom <= 1}
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            aria-label={t("preview.zoomOut")}
            title={t("preview.zoomOut")}
          >
            <ZoomOut aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={zoom >= most - 0.01}
            onClick={() => zoomBy(ZOOM_STEP)}
            aria-label={t("preview.zoomIn")}
            title={t("preview.zoomIn")}
          >
            <ZoomIn aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={zoom <= 1}
            onClick={() => showAll()}
            aria-label={t("preview.fit")}
            title={t("preview.fit")}
          >
            <Shrink aria-hidden />
          </Button>
        </fieldset>
      </div>
    </>
  );
}
