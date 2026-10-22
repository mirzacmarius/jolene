"use client";

import {
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Screen pixels per millimetre at 100 %: 96 to the inch, as CSS counts. */
export const PX_PER_MM = 96 / 25.4;

/** The zoom levels the buttons step through, 1 being 100 %. */
const LEVELS = [
  0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12,
  16,
];
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 16;
/** Room left around a fitted face, in pixels. */
const FIT_PADDING = 48;

/** The face as the canvas shows it: its trim size and the bleed shown around it, in millimetres. */
export interface ViewArea {
  width: number;
  height: number;
  bleed: number;
}

export interface Viewport {
  /** Screen pixels per millimetre. */
  scale: number;
  /** Where the face's top-left trim corner sits in the stage, in pixels. */
  x: number;
  y: number;
  /** A fitted view fits again when the stage changes size. */
  fitted: boolean;
}

interface Size {
  width: number;
  height: number;
}

const clampScale = (scale: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale / PX_PER_MM)) * PX_PER_MM;

function fitView(area: ViewArea, stage: Size): Viewport {
  const room = (size: number) => Math.max(size - 2 * FIT_PADDING, 40);
  const scale = clampScale(
    Math.min(
      room(stage.width) / (area.width + 2 * area.bleed),
      room(stage.height) / (area.height + 2 * area.bleed),
    ),
  );
  return {
    scale,
    x: (stage.width - area.width * scale) / 2,
    y: (stage.height - area.height * scale) / 2,
    fitted: true,
  };
}

/** The view at another scale, keeping the face's point under `anchor` where it is. */
function zoomed(view: Viewport, scale: number, anchor: Point): Viewport {
  const next = clampScale(scale);
  const ratio = next / view.scale;
  return {
    scale: next,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
    fitted: false,
  };
}

interface Point {
  x: number;
  y: number;
}

/**
 * Zoom and pan over a face, in the stage element's pixels. A face starts
 * fitted to the stage and stays fitted as the window changes, until the
 * visitor zooms or pans; another face fits anew.
 */
export function useViewport(
  stage: RefObject<HTMLElement | null>,
  area: ViewArea,
  /** Changes when another face is shown. */
  faceKey: string,
) {
  const size = useRef<Size>({ width: 0, height: 0 });
  // The same size, for what is drawn to fit inside the stage.
  const [stageSize, setStageSize] = useState<Size>(size.current);
  const [view, setView] = useState<Viewport | null>(null);
  const areaRef = useRef(area);
  useLayoutEffect(() => {
    areaRef.current = area;
  });

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      size.current = { width, height };
      setStageSize(size.current);
      setView((current) =>
        !current || current.fitted
          ? fitView(areaRef.current, size.current)
          : current,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [stage]);

  // Another face fits anew; the bleed coming or going keeps a chosen zoom.
  const { width, height, bleed } = area;
  const shown = useRef(faceKey);
  useLayoutEffect(() => {
    const another = shown.current !== faceKey;
    shown.current = faceKey;
    if (size.current.width === 0) return;
    setView((current) =>
      !current || current.fitted || another
        ? fitView({ width, height, bleed }, size.current)
        : current,
    );
  }, [faceKey, width, height, bleed]);

  const actions = useMemo(() => {
    const middle = () => ({
      x: size.current.width / 2,
      y: size.current.height / 2,
    });
    const change = (next: (view: Viewport) => Viewport) =>
      setView((current) => (current ? next(current) : current));
    return {
      /** Zooms to `scale` pixels per millimetre about a point of the stage, or its middle. */
      zoomTo: (scale: number, anchor?: Point) =>
        change((view) => zoomed(view, scale, anchor ?? middle())),
      zoomBy: (factor: number, anchor?: Point) =>
        change((view) => zoomed(view, view.scale * factor, anchor ?? middle())),
      /** To the next zoom level up (1) or down (-1). */
      step: (direction: 1 | -1) =>
        change((view) => {
          const zoom = view.scale / PX_PER_MM;
          const level =
            direction === 1
              ? (LEVELS.find((candidate) => candidate > zoom * 1.001) ??
                MAX_ZOOM)
              : ([...LEVELS]
                  .reverse()
                  .find((candidate) => candidate < zoom / 1.001) ?? MIN_ZOOM);
          return zoomed(view, level * PX_PER_MM, middle());
        }),
      /** 100 %: the face at its printed size, as near as the screen allows. */
      actualSize: () => change((view) => zoomed(view, PX_PER_MM, middle())),
      fitToStage: () =>
        setView((current) =>
          size.current.width === 0
            ? current
            : fitView(areaRef.current, size.current),
        ),
      panBy: (dx: number, dy: number) =>
        change((view) => ({
          ...view,
          x: view.x + dx,
          y: view.y + dy,
          fitted: false,
        })),
    };
  }, []);

  return { view, stageSize, ...actions };
}

export type ViewportControls = ReturnType<typeof useViewport>;
