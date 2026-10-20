import type { Operation } from "../ops";
import {
  type DesignDocument,
  type FaceName,
  faceNames,
  type Layer,
  type TextStyle,
} from "../schema";

/** One face of one piece, as operations name it. */
export interface FaceRef {
  piece: string;
  face: FaceName;
}

function layersOf(document: DesignDocument, { piece, face }: FaceRef): Layer[] {
  return (
    document.pieces.find((candidate) => candidate.id === piece)?.[face]
      ?.layers ?? []
  );
}

/** Every id the document uses: pieces, layers and accessories share them. */
export function documentIds(document: DesignDocument): Set<string> {
  const ids = new Set<string>();
  for (const piece of document.pieces) {
    ids.add(piece.id);
    for (const face of faceNames)
      for (const layer of piece[face]?.layers ?? []) ids.add(layer.id);
  }
  for (const accessory of document.accessories) ids.add(accessory.id);
  return ids;
}

/**
 * An id for a new layer that nothing in the document uses: `base` made into
 * an id, else with a number after it ("text-2"). `taken` collects the ids of
 * layers being added in the same batch.
 */
export function newLayerId(
  document: DesignDocument,
  base: string,
  taken: Set<string> = documentIds(document),
): string {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "layer";
  let id = clean;
  // A copy of "names-2" is "names-3", not "names-2-2".
  const stem = clean.replace(/-\d+$/, "") || clean;
  for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`;
  taken.add(id);
  return id;
}

/**
 * Copies of the layers, each just above its original and shifted by
 * `offset` millimetres, with ids of their own. Copies are never locked, so
 * a copy of Jolene's artwork can be moved.
 */
export function duplicateLayers(
  document: DesignDocument,
  target: FaceRef,
  ids: readonly string[],
  offset = 0,
): { operations: Operation[]; ids: string[] } {
  const layers = layersOf(document, target);
  const taken = documentIds(document);
  const operations: Operation[] = [];
  const copies: string[] = [];
  // From the top down, so inserting a copy doesn't move the next original.
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index] as Layer;
    if (!ids.includes(layer.id)) continue;
    const id = newLayerId(document, layer.id, taken);
    const copy = structuredClone(layer);
    copy.id = id;
    copy.locked = false;
    copy.frame = {
      ...copy.frame,
      x: copy.frame.x + offset,
      y: copy.frame.y + offset,
    };
    operations.push({
      op: "addLayer",
      ...target,
      layer: copy,
      index: index + 1,
    });
    copies.unshift(id);
  }
  return { operations, ids: copies };
}

export type Restack = "forward" | "backward" | "front" | "back";

/**
 * The moves that bring layers one step forward or back, or all the way to
 * the front or back, keeping their order among themselves. A layer already
 * there, or blocked by another one moving, stays.
 */
export function restackLayers(
  document: DesignDocument,
  target: FaceRef,
  ids: readonly string[],
  how: Restack,
): Operation[] {
  const order = layersOf(document, target).map((layer) => layer.id);
  const chosen = new Set(ids.filter((id) => order.includes(id)));
  const operations: Operation[] = [];
  const move = (id: string, index: number) => {
    const from = order.indexOf(id);
    if (from === index) return;
    order.splice(from, 1);
    order.splice(index, 0, id);
    operations.push({ op: "moveLayer", ...target, layer: id, index });
  };
  const bottomUp = order.filter((id) => chosen.has(id));
  const topDown = [...bottomUp].reverse();
  switch (how) {
    case "front":
      for (const id of bottomUp) move(id, order.length - 1);
      break;
    case "back":
      for (const id of topDown) move(id, 0);
      break;
    case "forward":
      for (const id of topDown) {
        const at = order.indexOf(id);
        const above = order[at + 1];
        if (above !== undefined && !chosen.has(above)) move(id, at + 1);
      }
      break;
    case "backward":
      for (const id of bottomUp) {
        const at = order.indexOf(id);
        const below = order[at - 1];
        if (below !== undefined && !chosen.has(below)) move(id, at - 1);
      }
      break;
  }
  return operations;
}

/**
 * Puts a layer back as `layer`, in its place in the stack. Operations change
 * what they name and can't take a property away, so clearing an override
 * or a minimum size replaces the layer whole.
 */
export function replaceLayer(
  document: DesignDocument,
  target: FaceRef,
  layer: Layer,
): Operation[] {
  const index = layersOf(document, target).findIndex(
    (candidate) => candidate.id === layer.id,
  );
  if (index < 0) return [];
  return [
    { op: "removeLayer", ...target, layer: layer.id },
    { op: "addLayer", ...target, layer, index },
  ];
}

/** What an updateLayer operation changes. */
export type LayerChanges = Extract<Operation, { op: "updateLayer" }>["set"];

/**
 * The document as it would look with some of a face's layers changed the way
 * updateLayer changes them, for a preview while a handle is dragged or a word
 * typed. It isn't validated, and every part that doesn't change is shared
 * with `document`, so the untouched layers are the very same objects.
 */
export function previewLayers(
  document: DesignDocument,
  target: FaceRef,
  changes: ReadonlyMap<string, LayerChanges>,
): DesignDocument {
  if (changes.size === 0) return document;
  return {
    ...document,
    pieces: document.pieces.map((piece) => {
      const face = piece.id === target.piece ? piece[target.face] : null;
      if (!face) return piece;
      const layers = face.layers.map((layer) => {
        const set = changes.get(layer.id);
        return set ? changeLayer(layer, set) : layer;
      });
      return { ...piece, [target.face]: { ...face, layers } };
    }),
  };
}

function changeLayer(layer: Layer, set: LayerChanges): Layer {
  const { frame, overrides, tint, ...rest } = set;
  // null takes the tint off; left out, the layer keeps its own.
  const { tint: current, ...untinted } = layer as Layer & { tint?: string };
  const nextTint = tint === undefined ? current : (tint ?? undefined);
  const next: Record<string, unknown> = {
    ...untinted,
    ...rest,
    ...(nextTint === undefined ? {} : { tint: nextTint }),
  };
  if (frame) next.frame = { ...layer.frame, ...frame };
  if (overrides && layer.type === "text")
    next.overrides = { ...layer.overrides, ...overrides };
  return next as Layer;
}

/** Lets a text layer follow its style again for `keys`. */
export function clearOverrides(
  document: DesignDocument,
  target: FaceRef,
  layerId: string,
  keys: readonly (keyof TextStyle)[],
): Operation[] {
  const layer = layersOf(document, target).find(
    (candidate) => candidate.id === layerId,
  );
  if (layer?.type !== "text") return [];
  if (!keys.some((key) => Object.hasOwn(layer.overrides, key))) return [];
  const overrides = Object.fromEntries(
    Object.entries(layer.overrides).filter(
      ([key]) => !keys.includes(key as keyof TextStyle),
    ),
  );
  return replaceLayer(document, target, { ...layer, overrides });
}
