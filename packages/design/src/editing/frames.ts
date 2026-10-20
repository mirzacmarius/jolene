import type { Box } from "../geometry";
import type { Frame } from "../schema";

/**
 * The geometry of a layer on its face: its frame in millimetres, turned
 * `rotation` degrees clockwise about the frame's centre, as the renderer
 * draws it.
 */

export interface Point {
  x: number;
  y: number;
}

/** Where a layer sits: its frame and its rotation, in degrees clockwise. */
export interface Placement {
  frame: Frame;
  rotation: number;
}

const RADIANS_PER_DEGREE = Math.PI / 180;

export function frameCentre(frame: Frame): Point {
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

/**
 * `point` turned `degrees` clockwise about `centre`. The y axis points down,
 * as on the page, so a positive angle turns clockwise as SVG's rotate does.
 */
export function rotatePoint(
  point: Point,
  centre: Point,
  degrees: number,
): Point {
  if (degrees % 360 === 0) return { ...point };
  const angle = degrees * RADIANS_PER_DEGREE;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return {
    x: centre.x + dx * cos - dy * sin,
    y: centre.y + dx * sin + dy * cos,
  };
}

/** An angle in degrees, between -180 (excluded) and 180. */
export function normalizeRotation(degrees: number): number {
  const turned = ((degrees % 360) + 360) % 360;
  const normal = turned > 180 ? turned - 360 : turned;
  // -0 reads as 0 in an input.
  return normal === 0 ? 0 : normal;
}

/** The frame's corners on the face: top left, top right, bottom right, bottom left. */
export function placementCorners({
  frame,
  rotation,
}: Placement): [Point, Point, Point, Point] {
  const centre = frameCentre(frame);
  const { x, y, width, height } = frame;
  return [
    rotatePoint({ x, y }, centre, rotation),
    rotatePoint({ x: x + width, y }, centre, rotation),
    rotatePoint({ x: x + width, y: y + height }, centre, rotation),
    rotatePoint({ x, y: y + height }, centre, rotation),
  ];
}

/** The smallest upright box around a placed frame. */
export function placementBounds(placement: Placement): Box {
  if (placement.rotation % 360 === 0) return { ...placement.frame };
  return boundsOfPoints(placementCorners(placement));
}

function boundsOfPoints(points: readonly Point[]): Box {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** The box around all of `boxes`, or null when there are none. */
export function unionBounds(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  return boundsOfPoints(
    boxes.flatMap((box) => [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
    ]),
  );
}

/**
 * Whether `point` falls on the placed frame, or within `tolerance`
 * millimetres of it, so a hairline can still be picked.
 */
export function placementContains(
  placement: Placement,
  point: Point,
  tolerance = 0,
): boolean {
  const { frame, rotation } = placement;
  const local = rotatePoint(point, frameCentre(frame), -rotation);
  return (
    local.x >= frame.x - tolerance &&
    local.x <= frame.x + frame.width + tolerance &&
    local.y >= frame.y - tolerance &&
    local.y <= frame.y + frame.height + tolerance
  );
}

/** Whether two upright boxes overlap or touch. */
export function boxesMeet(a: Box, b: Box): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}
