import type { Box } from "../geometry";
import type { Layer } from "../schema";
import {
  boxesMeet,
  type Point,
  placementBounds,
  placementContains,
} from "./frames";

export interface HitOptions {
  /** Millimetres around each frame that still count, for thin lines. */
  tolerance?: number;
  /**
   * Locked layers are passed over by default, so a click on Jolene's
   * artwork reaches the words above or below it.
   */
  includeLocked?: boolean;
}

/**
 * The topmost visible layer whose frame, as rotated on the face, lies under
 * `point`. Later layers draw on top, so the search runs from the end.
 */
export function hitLayer(
  layers: readonly Layer[],
  point: Point,
  { tolerance = 0, includeLocked = false }: HitOptions = {},
): Layer | undefined {
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index] as Layer;
    if (layer.hidden || (layer.locked && !includeLocked)) continue;
    if (placementContains(layer, point, tolerance)) return layer;
  }
  return undefined;
}

/**
 * The visible layers that a box drawn across the face touches, bottom to top,
 * as a marquee selects them.
 */
export function layersInBox(
  layers: readonly Layer[],
  box: Box,
  { includeLocked = false }: Pick<HitOptions, "includeLocked"> = {},
): Layer[] {
  return layers.filter(
    (layer) =>
      !layer.hidden &&
      (includeLocked || !layer.locked) &&
      boxesMeet(placementBounds(layer), box),
  );
}
