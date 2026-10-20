import type { Frame } from "../schema";
import {
  frameCentre,
  normalizeRotation,
  type Point,
  rotatePoint,
} from "./frames";
import { type SnapFace, type SnapGuide, type SnapLine, snapBox } from "./snap";

/**
 * Resizing and rotating a layer by its handles. The handles sit on the
 * frame as drawn, rotation included, and the side or corner opposite the
 * dragged handle stays where it is on the face.
 */

/** The eight resize handles, by compass point; "n" is the top edge's middle. */
export const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type Handle = (typeof handles)[number];

/** Which way a handle moves each edge: -1 the start (left, top), 1 the end, 0 neither. */
export const handleDirections: Record<
  Handle,
  { x: -1 | 0 | 1; y: -1 | 0 | 1 }
> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
};

/** Where a handle sits on the unrotated frame, in the face's millimetres. */
export function handlePoint(frame: Frame, handle: Handle): Point {
  const direction = handleDirections[handle];
  return {
    x: frame.x + ((direction.x + 1) / 2) * frame.width,
    y: frame.y + ((direction.y + 1) / 2) * frame.height,
  };
}

/** Layers never shrink below this, in millimetres, so they can still be picked. */
export const MIN_LAYER_SIZE = 1;

export interface ResizeOptions {
  frame: Frame;
  rotation: number;
  handle: Handle;
  /** The pointer, in the face's millimetres. */
  pointer: Point;
  /** Keep the frame's proportions, as Shift does. */
  keepRatio?: boolean;
  /**
   * With `keepRatio` on a corner, the axis whose edge follows the pointer;
   * by default the one that changed most.
   */
  ratioAxis?: "x" | "y";
  minSize?: number;
}

/** The frame after dragging one of its handles to `pointer`. */
export function resizeFrame({
  frame,
  rotation,
  handle,
  pointer,
  keepRatio = false,
  ratioAxis,
  minSize = MIN_LAYER_SIZE,
}: ResizeOptions): Frame {
  const direction = handleDirections[handle];
  const { x, y, width, height } = frame;
  const centre = frameCentre(frame);
  // The pointer as if the frame weren't turned.
  const local = rotatePoint(pointer, centre, -rotation);
  const along = (d: -1 | 0 | 1, at: number, start: number, size: number) =>
    d === 1 ? at - start : d === -1 ? start + size - at : size;
  let nextWidth = Math.max(minSize, along(direction.x, local.x, x, width));
  let nextHeight = Math.max(minSize, along(direction.y, local.y, y, height));

  if (keepRatio) {
    const ratio = width / height;
    const axis =
      direction.x === 0
        ? "y"
        : direction.y === 0
          ? "x"
          : (ratioAxis ??
            (Math.abs(nextWidth / width - 1) >=
            Math.abs(nextHeight / height - 1)
              ? "x"
              : "y"));
    if (axis === "x") nextHeight = nextWidth / ratio;
    else nextWidth = nextHeight * ratio;
    const grow = Math.max(1, minSize / nextWidth, minSize / nextHeight);
    nextWidth *= grow;
    nextHeight *= grow;
  }

  // The edges the handle doesn't move stay put; an edge handle with the
  // proportions kept grows the other way evenly about the middle.
  const place = (d: -1 | 0 | 1, size: number, next: number) =>
    d === 1 ? 0 : d === -1 ? size - next : (size - next) / 2;
  const left = place(direction.x, width, nextWidth);
  const top = place(direction.y, height, nextHeight);
  const nextCentre = rotatePoint(
    { x: x + left + nextWidth / 2, y: y + top + nextHeight / 2 },
    centre,
    rotation,
  );
  return {
    x: nextCentre.x - nextWidth / 2,
    y: nextCentre.y - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  };
}

export interface SnapResizeOptions extends ResizeOptions {
  face: SnapFace;
  others: readonly Frame[];
  threshold: number;
}

/** Lines closer than this already sit on their guide, in millimetres. */
const ON_GUIDE = 0.001;

/**
 * Resizes and snaps the dragged edges to the face and the other layers. Only
 * an upright frame snaps: a turned one's edges don't run along the guides.
 */
export function snapResize(options: SnapResizeOptions): {
  frame: Frame;
  guides: SnapGuide[];
} {
  const frame = resizeFrame(options);
  if (options.rotation % 360 !== 0) return { frame, guides: [] };
  const direction = handleDirections[options.handle];
  const lineOf = (d: -1 | 0 | 1): SnapLine[] =>
    d === 1 ? ["end"] : d === -1 ? ["start"] : [];
  const lines = { x: lineOf(direction.x), y: lineOf(direction.y) };
  const snap = (
    box: Frame,
    only: { x: SnapLine[]; y: SnapLine[] },
    threshold: number,
  ) =>
    snapBox({
      box,
      mode: "resize",
      lines: only,
      face: options.face,
      others: options.others,
      threshold,
    });
  const snapped = snap(frame, lines, options.threshold);
  if (!options.keepRatio) return { frame: snapped.box, guides: snapped.guides };

  // Keeping the proportions, one edge follows its guide and the other
  // follows the ratio: the axis that needs the smaller nudge wins.
  const axes = (["x", "y"] as const).filter(
    (axis) => snapped.snapped[axis] !== null,
  );
  if (axes.length === 0) return { frame, guides: [] };
  const axis = axes.reduce((best, candidate) =>
    Math.abs(snapped.offset[candidate]) < Math.abs(snapped.offset[best])
      ? candidate
      : best,
  );
  // The dragged edge on that axis, moved onto its guide.
  const start = axis === "x" ? frame.x : frame.y;
  const size = axis === "x" ? frame.width : frame.height;
  const edge = direction[axis] === 1 ? start + size : start;
  const pointer = { ...options.pointer, [axis]: edge + snapped.offset[axis] };
  const kept = resizeFrame({ ...options, pointer, ratioAxis: axis });
  const only = axis === "x" ? { x: lines.x, y: [] } : { x: [], y: lines.y };
  return { frame: kept, guides: snap(kept, only, ON_GUIDE).guides };
}

export interface RotateOptions {
  /** The frame's centre, which it turns about. */
  centre: Point;
  /** The rotation when the drag started. */
  start: number;
  /** Where the drag started and where the pointer is now, in millimetres. */
  from: Point;
  to: Point;
  /** Snap to multiples of this many degrees, as Shift does with 15. */
  step?: number;
}

/** The rotation after turning the frame by dragging from `from` to `to`. */
export function rotateTo({
  centre,
  start,
  from,
  to,
  step,
}: RotateOptions): number {
  const angle = (point: Point) =>
    (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI;
  const turned = start + angle(to) - angle(from);
  const snapped = step ? Math.round(turned / step) * step : turned;
  return normalizeRotation(Math.round(snapped * 100) / 100);
}
