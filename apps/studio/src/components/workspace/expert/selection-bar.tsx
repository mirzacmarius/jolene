"use client";

import type { Box } from "@jolene/design";
import type { SyntheticEvent } from "react";
import { useI18n } from "@/locales/client";
import { type LayerActions, LayerActionButtons } from "./layer-actions";
import { ROTATE_ROOM } from "./overlay";

/** Room between the bar, the selection and the stage's edges, in pixels. */
const GAP = 10;
/** The bar's size, in pixels: two 28 px buttons in a pill. */
const WIDTH = 64;
const HEIGHT = 34;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** The canvas keeps its own pointer and keys away from the bar. */
const stop = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Duplicate and delete beside the selection on the canvas, where the eye
 * already is: under it, or over it when there's no room below.
 */
export function SelectionBar({
  bounds,
  stage,
  bottomInset = 0,
  actions,
  onPointerEnter,
}: {
  /** The selection's upright box, in the stage's pixels. */
  bounds: Box;
  /** The stage's size, in pixels. */
  stage: { width: number; height: number };
  /** Pixels along the stage's bottom edge that its own controls keep. */
  bottomInset?: number;
  actions: LayerActions;
  /** The pointer has come off the canvas onto the bar. */
  onPointerEnter: () => void;
}) {
  const t = useI18n();
  // A selection panned out of sight leaves the bar with it.
  if (
    bounds.x > stage.width ||
    bounds.y > stage.height ||
    bounds.x + bounds.width < 0 ||
    bounds.y + bounds.height < 0
  )
    return null;
  const bottom = stage.height - bottomInset - GAP;
  const below = bounds.y + bounds.height + GAP;
  const above = bounds.y - ROTATE_ROOM - GAP - HEIGHT;
  const top =
    below + HEIGHT <= bottom
      ? below
      : above >= GAP
        ? above
        : clamp(below, GAP, bottom - HEIGHT);
  const left = clamp(
    bounds.x + bounds.width / 2,
    GAP + WIDTH / 2,
    stage.width - GAP - WIDTH / 2,
  );
  return (
    <div
      role="toolbar"
      aria-label={t("expert.actions.label")}
      className="absolute flex -translate-x-1/2 items-center rounded-full border border-border/70 bg-card/95 p-0.5 shadow-md backdrop-blur"
      style={{ left, top }}
      onPointerEnter={onPointerEnter}
      onPointerDown={stop}
      onPointerMove={stop}
      onDoubleClick={stop}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <LayerActionButtons actions={actions} />
    </div>
  );
}
