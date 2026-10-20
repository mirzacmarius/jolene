import { z } from "zod";
import { inks, languages } from "./catalog";
import {
  accessorySchema,
  colorRefSchema,
  type DesignDocument,
  documentSchema,
  envelopeSchema,
  type FaceName,
  faceNames,
  foldSchema,
  frameSchema,
  idSchema,
  imageLayerSchema,
  type Layer,
  layerSchema,
  type Piece,
  paletteSchema,
  pieceShapeSchema,
  placeSchema,
  shapeLayerSchema,
  stockIds,
  strokeSchema,
  textLayerSchema,
  textStyleOverridesSchema,
  textStyleTokens,
} from "./schema";

/**
 * Every change to a design is one of these operations. The editor turns
 * clicks and drags into them, the AI co-designer proposes them as tool calls,
 * and applying a batch either yields a valid document or changes nothing.
 */

const target = {
  piece: idSchema,
  face: z.enum(faceNames),
};

/**
 * Layer properties an operation may change. A layer's id and type are fixed;
 * replacing a text layer with an image is a remove and an add.
 */
const layerChangesSchema = z
  .object({
    name: z.string().max(80),
    frame: frameSchema.partial(),
    rotation: z.number(),
    opacity: z.number(),
    hidden: z.boolean(),
    locked: z.boolean(),
    ink: z.enum(inks),
    text: z.string(),
    style: z.enum(textStyleTokens),
    overrides: textStyleOverridesSchema,
    align: z.enum(["left", "center", "right"]),
    valign: z.enum(["top", "middle", "bottom"]),
    /** "none" or "shrink" for words, "contain", "cover" or "fill" for a picture. */
    fit: z.enum(["none", "shrink", "contain", "cover", "fill"]),
    minSize: z.number().positive(),
    asset: z.string().min(1),
    /** null takes the tint off. */
    tint: colorRefSchema.nullable(),
    replaceable: z.boolean(),
    flipX: z.boolean(),
    flipY: z.boolean(),
    shape: z.enum(["rect", "ellipse", "line", "path"]),
    path: z.string(),
    fill: colorRefSchema.nullable(),
    stroke: strokeSchema.nullable(),
    radius: z.number().min(0),
  })
  .partial()
  .strict();

const pieceChangesSchema = z
  .object({
    name: z.string().max(80),
    width: z.number().positive(),
    height: z.number().positive(),
    bleed: z.number().min(0),
    safeMargin: z.number().min(0),
    shape: pieceShapeSchema,
    fold: foldSchema.nullable(),
    stock: z.enum(stockIds),
    paper: colorRefSchema.nullable(),
    place: placeSchema,
    /** The printed background of the face the operation names. */
    background: colorRefSchema.nullable(),
  })
  .partial()
  .strict();

const layerShapes = {
  text: textLayerSchema.shape,
  image: imageLayerSchema.shape,
  shape: shapeLayerSchema.shape,
};

export const operationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("updateLayer"),
    ...target,
    layer: idSchema,
    set: layerChangesSchema,
  }),
  z.object({
    op: z.literal("addLayer"),
    ...target,
    layer: layerSchema,
    /** Position in the stack, 0 at the back; at the front when left out. */
    index: z.number().int().min(0).optional(),
  }),
  z.object({ op: z.literal("removeLayer"), ...target, layer: idSchema }),
  z.object({
    op: z.literal("moveLayer"),
    ...target,
    layer: idSchema,
    index: z.number().int().min(0),
  }),
  z.object({
    op: z.literal("setPalette"),
    palette: paletteSchema.partial(),
  }),
  z.object({
    op: z.literal("setTextStyle"),
    style: z.enum(textStyleTokens),
    set: textStyleOverridesSchema,
  }),
  z.object({
    op: z.literal("updatePiece"),
    piece: idSchema,
    /** `background` sets the face background of `face` (front by default). */
    face: z.enum(faceNames).optional(),
    set: pieceChangesSchema,
  }),
  z.object({ op: z.literal("setAccessory"), accessory: accessorySchema }),
  z.object({ op: z.literal("removeAccessory"), id: idSchema }),
  z.object({
    op: z.literal("setEnvelope"),
    envelope: envelopeSchema.nullable(),
  }),
  /** Dates follow at once; the words are rewritten with their own operations. */
  z.object({ op: z.literal("setLanguage"), language: z.enum(languages) }),
]);
export type Operation = z.input<typeof operationSchema>;

export type ApplyResult =
  | { ok: true; document: DesignDocument }
  | { ok: false; error: string };

class OperationError extends Error {}

function findPiece(document: DesignDocument, id: string): Piece {
  const piece = document.pieces.find((candidate) => candidate.id === id);
  if (!piece) throw new OperationError(`No piece "${id}"`);
  return piece;
}

function findLayers(piece: Piece, face: FaceName): Layer[] {
  const layers = piece[face]?.layers;
  if (!layers)
    throw new OperationError(`Piece "${piece.id}" has no ${face} side`);
  return layers;
}

function indexOfLayer(layers: Layer[], id: string): number {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index < 0) throw new OperationError(`No layer "${id}"`);
  return index;
}

function applyOne(document: DesignDocument, input: Operation): void {
  const operation = operationSchema.parse(input);
  switch (operation.op) {
    case "updateLayer": {
      const layers = findLayers(
        findPiece(document, operation.piece),
        operation.face,
      );
      const index = indexOfLayer(layers, operation.layer);
      const layer = layers[index] as Layer;
      const foreign = Object.keys(operation.set).filter(
        (key) => !Object.hasOwn(layerShapes[layer.type], key),
      );
      if (foreign.length > 0)
        throw new OperationError(
          `Layer "${layer.id}" is ${layer.type === "image" ? "an" : "a"} ${layer.type} layer, which has no ${foreign.join(", ")}`,
        );
      const { frame, overrides, tint, ...rest } = operation.set;
      // null takes the tint off; left out, the layer keeps its own.
      const { tint: currentTint, ...untinted } = layer as Layer & {
        tint?: string;
      };
      const nextTint = tint === undefined ? currentTint : (tint ?? undefined);
      const next: Record<string, unknown> = {
        ...untinted,
        ...rest,
        ...(nextTint === undefined ? {} : { tint: nextTint }),
      };
      if (frame) next.frame = { ...layer.frame, ...frame };
      if (overrides && layer.type === "text")
        next.overrides = { ...layer.overrides, ...overrides };
      layers[index] = next as Layer;
      return;
    }
    case "addLayer": {
      const layers = findLayers(
        findPiece(document, operation.piece),
        operation.face,
      );
      const index = Math.min(operation.index ?? layers.length, layers.length);
      layers.splice(index, 0, operation.layer);
      return;
    }
    case "removeLayer": {
      const layers = findLayers(
        findPiece(document, operation.piece),
        operation.face,
      );
      layers.splice(indexOfLayer(layers, operation.layer), 1);
      return;
    }
    case "moveLayer": {
      const layers = findLayers(
        findPiece(document, operation.piece),
        operation.face,
      );
      const [layer] = layers.splice(indexOfLayer(layers, operation.layer), 1);
      layers.splice(
        Math.min(operation.index, layers.length),
        0,
        layer as Layer,
      );
      return;
    }
    case "setPalette":
      Object.assign(document.theme.palette, operation.palette);
      return;
    case "setTextStyle":
      Object.assign(document.theme.text[operation.style], operation.set);
      return;
    case "updatePiece": {
      const piece = findPiece(document, operation.piece);
      const { background, ...rest } = operation.set;
      Object.assign(piece, rest);
      if (background !== undefined) {
        const face = piece[operation.face ?? "front"];
        if (!face)
          throw new OperationError(
            `Piece "${piece.id}" has no ${operation.face} side`,
          );
        face.background = background as typeof face.background;
      }
      return;
    }
    case "setAccessory": {
      const index = document.accessories.findIndex(
        (accessory) => accessory.id === operation.accessory.id,
      );
      if (index < 0) document.accessories.push(operation.accessory);
      else document.accessories[index] = operation.accessory;
      return;
    }
    case "removeAccessory":
      document.accessories = document.accessories.filter(
        (accessory) => accessory.id !== operation.id,
      );
      return;
    case "setEnvelope":
      document.envelope = operation.envelope;
      return;
    case "setLanguage":
      document.language = operation.language;
      return;
  }
}

/**
 * Applies the operations in order to a copy of the document. Either all of
 * them apply and the result is a valid document, or none do and the error says
 * which operation failed and why.
 */
export function applyOperations(
  document: DesignDocument,
  operations: readonly Operation[],
): ApplyResult {
  const draft = structuredClone(document);
  for (const [index, operation] of operations.entries()) {
    try {
      applyOne(draft, operation);
    } catch (error) {
      const reason =
        error instanceof z.ZodError
          ? z.prettifyError(error)
          : error instanceof Error
            ? error.message
            : String(error);
      return { ok: false, error: `Operation ${index + 1}: ${reason}` };
    }
  }
  const result = documentSchema.safeParse(draft);
  if (!result.success)
    return { ok: false, error: z.prettifyError(result.error) };
  return { ok: true, document: result.data };
}
