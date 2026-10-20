import type { Box } from "../geometry";
import type { Frame } from "../schema";
import { type Placement, placementBounds, unionBounds } from "./frames";

/**
 * Lining layers up and spacing them evenly, by the upright boxes they cover
 * on the face, so a turned layer lines up by what it shows.
 */

export const alignments = [
  "left",
  "center",
  "right",
  "top",
  "middle",
  "bottom",
] as const;
export type Alignment = (typeof alignments)[number];

const moveBy = (frame: Frame, dx: number, dy: number): Frame => ({
  ...frame,
  x: frame.x + dx,
  y: frame.y + dy,
});

/**
 * The frames that line `placements` up on one side or centre line of
 * `target`: the box around them all unless given, such as the face's trim.
 */
export function alignPlacements(
  placements: readonly Placement[],
  alignment: Alignment,
  target?: Box,
): Frame[] {
  const boxes = placements.map(placementBounds);
  const to = target ?? unionBounds(boxes);
  if (!to) return [];
  const left = (box: Box) => to.x - box.x;
  const right = (box: Box) => to.x + to.width - (box.x + box.width);
  const top = (box: Box) => to.y - box.y;
  const bottom = (box: Box) => to.y + to.height - (box.y + box.height);
  const shifts: Record<Alignment, (box: Box) => [number, number]> = {
    left: (box) => [left(box), 0],
    center: (box) => [(left(box) + right(box)) / 2, 0],
    right: (box) => [right(box), 0],
    top: (box) => [0, top(box)],
    middle: (box) => [0, (top(box) + bottom(box)) / 2],
    bottom: (box) => [0, bottom(box)],
  };
  return placements.map((placement, index) =>
    moveBy(placement.frame, ...shifts[alignment](boxes[index] as Box)),
  );
}

/**
 * The frames that space `placements` evenly along an axis: the first and the
 * last stay, and the gaps between neighbours come out equal. Fewer than three
 * stay as they are.
 */
export function distributePlacements(
  placements: readonly Placement[],
  axis: "x" | "y",
): Frame[] {
  const frames = placements.map((placement) => ({ ...placement.frame }));
  if (placements.length < 3) return frames;
  const boxes = placements.map(placementBounds);
  const start = (box: Box) => (axis === "x" ? box.x : box.y);
  const size = (box: Box) => (axis === "x" ? box.width : box.height);
  const order = boxes
    .map((box, index) => ({ box, index }))
    .sort((a, b) => start(a.box) - start(b.box));
  const first = (order[0] as (typeof order)[number]).box;
  const last = (order[order.length - 1] as (typeof order)[number]).box;
  const span = start(last) + size(last) - start(first);
  const filled = order.reduce((sum, { box }) => sum + size(box), 0);
  const gap = (span - filled) / (order.length - 1);
  let at = start(first);
  for (const { box, index } of order) {
    const by = at - start(box);
    frames[index] = moveBy(
      placements[index]?.frame as Frame,
      axis === "x" ? by : 0,
      axis === "y" ? by : 0,
    );
    at += size(box) + gap;
  }
  return frames;
}
