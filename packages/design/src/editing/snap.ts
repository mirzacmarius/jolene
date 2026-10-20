import type { Box } from "../geometry";

/**
 * Snapping while a layer is moved or resized: its edges and centre lines are
 * drawn to the face's edges, centre lines, safe margin and bleed, and to the
 * other layers' edges and centres, when they come within a threshold. The
 * canvas passes a few screen pixels' worth of millimetres at its zoom.
 */

export type Axis = "x" | "y";
/** A box's lines along an axis: its left or top edge, its centre, its right or bottom edge. */
export type SnapLine = "start" | "center" | "end";

export interface SnapFace {
  width: number;
  height: number;
  bleed: number;
  safeMargin: number;
}

/**
 * A line to draw while snapped: on the "x" axis a vertical line at x = `at`,
 * from y = `from` to y = `to`; on "y" a horizontal one.
 */
export interface SnapGuide {
  axis: Axis;
  at: number;
  from: number;
  to: number;
}

export interface SnapOptions {
  /** Where the moving layer (or selection) would be, as an upright box. */
  box: Box;
  /** "move" shifts the box; "resize" moves only the lines being dragged. */
  mode: "move" | "resize";
  /** The lines of the box that may snap: all of them when moving, the dragged edges when resizing. */
  lines?: Partial<Record<Axis, readonly SnapLine[]>>;
  face: SnapFace;
  /** The other layers' upright boxes. */
  others: readonly Box[];
  /** How close, in millimetres, a line must come to snap. */
  threshold: number;
}

export interface SnapResult {
  /** The box after snapping. */
  box: Box;
  /** The line that snapped on each axis, or null where none did. */
  snapped: Record<Axis, SnapLine | null>;
  /** How far the snapped line moved on each axis. */
  offset: Record<Axis, number>;
  guides: SnapGuide[];
}

const allLines = ["start", "center", "end"] as const;
/** Lines this close count as the same line, in millimetres. */
const SAME = 0.001;

const startOf = (box: Box, axis: Axis) => (axis === "x" ? box.x : box.y);
const sizeOf = (box: Box, axis: Axis) =>
  axis === "x" ? box.width : box.height;

function lineAt(box: Box, axis: Axis, line: SnapLine): number {
  const start = startOf(box, axis);
  const size = sizeOf(box, axis);
  return line === "start"
    ? start
    : line === "center"
      ? start + size / 2
      : start + size;
}

/** The box's extent across the axis: a vertical guide's top and bottom. */
function across(box: Box, axis: Axis): [number, number] {
  const other: Axis = axis === "x" ? "y" : "x";
  return [startOf(box, other), startOf(box, other) + sizeOf(box, other)];
}

function faceLines(face: SnapFace, axis: Axis): number[] {
  const size = axis === "x" ? face.width : face.height;
  const lines = [0, size / 2, size];
  if (face.safeMargin > 0) lines.push(face.safeMargin, size - face.safeMargin);
  if (face.bleed > 0) lines.push(-face.bleed, size + face.bleed);
  return lines;
}

interface Target {
  at: number;
  /** The layer the line belongs to, or null for the face's own lines. */
  owner: Box | null;
}

function targetsOn(axis: Axis, face: SnapFace, others: readonly Box[]) {
  const targets: Target[] = faceLines(face, axis).map((at) => ({
    at,
    owner: null,
  }));
  for (const other of others)
    for (const line of allLines)
      targets.push({ at: lineAt(other, axis, line), owner: other });
  return targets;
}

function shift(
  box: Box,
  axis: Axis,
  line: SnapLine,
  by: number,
  mode: SnapOptions["mode"],
): Box {
  const next = { ...box };
  if (mode === "move" || line === "start") {
    if (axis === "x") next.x += by;
    else next.y += by;
  }
  if (mode === "resize") {
    const grow = line === "start" ? -by : line === "end" ? by : 0;
    if (axis === "x") next.width += grow;
    else next.height += grow;
  }
  return next;
}

/** Snaps a moving or resizing box, and says which guides to draw. */
export function snapBox({
  box,
  mode,
  lines = { x: allLines, y: allLines },
  face,
  others,
  threshold,
}: SnapOptions): SnapResult {
  const axes = ["x", "y"] as const;
  const targets = {
    x: targetsOn("x", face, others),
    y: targetsOn("y", face, others),
  };
  const snapped: SnapResult["snapped"] = { x: null, y: null };
  const offset = { x: 0, y: 0 };
  let result = { ...box };

  for (const axis of axes) {
    let best: { line: SnapLine; by: number } | null = null;
    for (const line of lines[axis] ?? []) {
      const at = lineAt(box, axis, line);
      for (const target of targets[axis]) {
        const by = target.at - at;
        if (
          Math.abs(by) <= threshold &&
          (!best || Math.abs(by) < Math.abs(best.by))
        )
          best = { line, by };
      }
    }
    if (!best) continue;
    snapped[axis] = best.line;
    offset[axis] = best.by;
    result = shift(result, axis, best.line, best.by, mode);
  }

  // Every line now lying on a snapped axis' target gets its guide; lines
  // that meet several layers at once share one guide across all of them.
  const guides: SnapGuide[] = [];
  for (const axis of axes) {
    if (!snapped[axis]) continue;
    const moving = (lines[axis] ?? []).map((line) =>
      lineAt(result, axis, line),
    );
    const met = targets[axis].filter((target) =>
      moving.some((at) => Math.abs(at - target.at) < SAME),
    );
    const byLine = new Map<number, Target[]>();
    for (const target of met) {
      const key = Math.round(target.at / SAME);
      byLine.set(key, [...(byLine.get(key) ?? []), target]);
    }
    for (const group of byLine.values()) {
      const at = (group[0] as Target).at;
      let [from, to] = across(result, axis);
      for (const target of group) {
        const [start, end] = target.owner
          ? across(target.owner, axis)
          : axis === "x"
            ? [-face.bleed, face.height + face.bleed]
            : [-face.bleed, face.width + face.bleed];
        from = Math.min(from, start);
        to = Math.max(to, end);
      }
      guides.push({ axis, at, from, to });
    }
  }
  return { box: result, snapped, offset, guides };
}
