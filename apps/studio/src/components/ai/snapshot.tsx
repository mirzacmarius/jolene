"use client";

import { layoutReport, type TextFit } from "@jolene/backend/convex/ai/report";
import { type DesignDocument, type Fields, faceNames } from "@jolene/design";
import { createCanvasMeasure } from "@jolene/design/react";
import type { AssetLink, PreviewView } from "../design/design-preview";
import { canvasBlob, renderCanvas } from "../design/render-image";

/**
 * The design as the couple sees it, drawn into a PNG for the AI designer
 * (renderCanvas), so what the model sees doesn't depend on what else the page
 * shows.
 */

/**
 * The snapshot's long side, in pixels: a face's smallest lines still read,
 * and the model counts about 1,000 tokens for it, where 1600 pixels took
 * 2,500. Every message and rendering carries one.
 */
const LONG_SIDE = 1000;

/** Bigger than this, the snapshot goes as a JPEG to fit the API's limit. */
const MAX_PNG_BYTES = 3_750_000;

export interface Snapshot {
  image: Blob;
  /** How every face's words sit, measured in the fonts the page loaded. */
  layers: TextFit[];
}

/**
 * Draws the view as a PNG (a JPEG when the PNG would be too big), with the
 * layout report of the whole design measured in the real fonts.
 */
export async function takeSnapshot({
  design,
  fields,
  assets,
  view,
}: {
  design: DesignDocument;
  fields: Fields;
  assets: readonly AssetLink[];
  view: PreviewView;
}): Promise<Snapshot> {
  const canvas = await renderCanvas({
    design,
    fields,
    assets,
    view,
    longSide: LONG_SIDE,
  });
  let image = await canvasBlob(canvas, "image/png");
  if (image.size > MAX_PNG_BYTES)
    image = await canvasBlob(canvas, "image/jpeg", 0.9);
  // The fonts have loaded for the drawing, so they measure true.
  const measure = createCanvasMeasure();
  return { image, layers: layoutReport(design, fields, { measure }).layers };
}

/** "assembly", or a face as "piece:face": how the backend names a view. */
export function viewName(view: PreviewView): string {
  return view.kind === "assembly" ? "assembly" : `${view.piece}:${view.face}`;
}

/** The view a name stands for, when the design has it; the fallback if not. */
export function viewNamed(
  name: string | undefined,
  design: DesignDocument,
  fallback: PreviewView,
): PreviewView {
  if (name === "assembly") return { kind: "assembly" };
  const [pieceId, faceName] = name?.split(":") ?? [];
  const piece = design.pieces.find((each) => each.id === pieceId);
  const face = faceNames.find((each) => each === faceName);
  return piece && face && piece[face]
    ? { kind: "face", piece: piece.id, face }
    : fallback;
}
