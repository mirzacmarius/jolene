import { z } from "zod";
import { applyOperations, type Operation, operationSchema } from "../ops";
import type { DesignDocument, FaceName, Layer, Piece } from "../schema";

/**
 * Undoing a change: the operations that take a design back to where a batch
 * found it. They are computed against the document before the batch, and
 * travel to the backend like any other change, so they never carry
 * `undefined` (which doesn't survive the trip): a property the batch gave a
 * layer that had none comes off by putting the layer back as it was.
 */

type Parsed = z.output<typeof operationSchema>;
type LayerSet = Extract<Parsed, { op: "updateLayer" }>["set"];

function findPiece(document: DesignDocument, id: string): Piece | undefined {
  return document.pieces.find((piece) => piece.id === id);
}

function findLayer(
  document: DesignDocument,
  piece: string,
  face: FaceName,
  id: string,
) {
  const layers = findPiece(document, piece)?.[face]?.layers ?? [];
  const index = layers.findIndex((layer) => layer.id === id);
  return index < 0 ? null : { layer: layers[index] as Layer, index };
}

const pick = <T extends object>(source: T, keys: readonly string[]) =>
  Object.fromEntries(
    keys.map((key) => [key, source[key as keyof T]]),
  ) as Partial<T>;

/** The operations that undo one operation, applied to `document`. */
function invertOne(document: DesignDocument, operation: Parsed): Operation[] {
  switch (operation.op) {
    case "updateLayer": {
      const { piece, face } = operation;
      const found = findLayer(document, piece, face, operation.layer);
      if (!found) return [];
      const { layer, index } = found;
      const current = layer as Record<string, unknown>;
      const set: Record<string, unknown> = {};
      let whole = false;
      for (const key of Object.keys(operation.set) as (keyof LayerSet)[]) {
        if (key === "frame") {
          set.frame = pick(layer.frame, Object.keys(operation.set.frame ?? {}));
        } else if (key === "overrides" && layer.type === "text") {
          const keys = Object.keys(operation.set.overrides ?? {});
          if (keys.some((name) => !Object.hasOwn(layer.overrides, name)))
            whole = true;
          set.overrides = pick(layer.overrides, keys);
        } else if (key === "tint") {
          // null takes a tint off.
          set.tint = current.tint ?? null;
        } else if (current[key] === undefined) {
          whole = true;
        } else {
          set[key] = current[key];
        }
      }
      if (whole)
        return [
          { op: "removeLayer", piece, face, layer: layer.id },
          { op: "addLayer", piece, face, layer: structuredClone(layer), index },
        ];
      return [
        { op: "updateLayer", piece, face, layer: layer.id, set } as Operation,
      ];
    }
    case "addLayer":
      return [
        {
          op: "removeLayer",
          piece: operation.piece,
          face: operation.face,
          layer: operation.layer.id,
        },
      ];
    case "removeLayer": {
      const { piece, face } = operation;
      const found = findLayer(document, piece, face, operation.layer);
      if (!found) return [];
      return [
        {
          op: "addLayer",
          piece,
          face,
          layer: structuredClone(found.layer),
          index: found.index,
        },
      ];
    }
    case "moveLayer": {
      const { piece, face } = operation;
      const found = findLayer(document, piece, face, operation.layer);
      if (!found) return [];
      return [
        {
          op: "moveLayer",
          piece,
          face,
          layer: operation.layer,
          index: found.index,
        },
      ];
    }
    case "setPalette":
      return [
        {
          op: "setPalette",
          palette: pick(document.theme.palette, Object.keys(operation.palette)),
        },
      ];
    case "setTextStyle":
      return [
        {
          op: "setTextStyle",
          style: operation.style,
          set: pick(
            document.theme.text[operation.style],
            Object.keys(operation.set),
          ),
        },
      ];
    case "updatePiece": {
      const piece = findPiece(document, operation.piece);
      if (!piece) return [];
      const set: Record<string, unknown> = {};
      for (const key of Object.keys(operation.set)) {
        if (key === "background")
          set.background = piece[operation.face ?? "front"]?.background ?? null;
        else if (piece[key as keyof Piece] === undefined)
          // Only a piece's name can be missing, and no operation takes one
          // away: undo can't give the piece its namelessness back.
          throw new Error(`Piece "${piece.id}" had no ${key} to go back to`);
        else set[key] = structuredClone(piece[key as keyof Piece]);
      }
      return [
        {
          op: "updatePiece",
          piece: piece.id,
          ...(operation.face ? { face: operation.face } : {}),
          set,
        } as Operation,
      ];
    }
    case "setAccessory": {
      const existing = document.accessories.find(
        (accessory) => accessory.id === operation.accessory.id,
      );
      return existing
        ? [{ op: "setAccessory", accessory: structuredClone(existing) }]
        : [{ op: "removeAccessory", id: operation.accessory.id }];
    }
    case "removeAccessory": {
      const index = document.accessories.findIndex(
        (accessory) => accessory.id === operation.id,
      );
      if (index < 0) return [];
      // setAccessory adds at the end: put back the removed accessory, then
      // the ones after it, so they stand in their first order.
      const [removed, ...after] = document.accessories.slice(index);
      return [
        { op: "setAccessory", accessory: structuredClone(removed) },
        ...after.flatMap((accessory): Operation[] => [
          { op: "removeAccessory", id: accessory.id },
          { op: "setAccessory", accessory: structuredClone(accessory) },
        ]),
      ] as Operation[];
    }
    case "setEnvelope":
      return [
        { op: "setEnvelope", envelope: structuredClone(document.envelope) },
      ];
    case "setLanguage":
      return [{ op: "setLanguage", language: document.language }];
  }
}

/**
 * The operations that undo `operations`: applied to the document they
 * produce from `document`, they give `document` back. Throws when the batch
 * itself doesn't apply to `document`, or can't be undone.
 */
export function invertOperations(
  document: DesignDocument,
  operations: readonly Operation[],
): Operation[] {
  const inverses: Operation[][] = [];
  let current = document;
  for (const [index, input] of operations.entries()) {
    const parsed = operationSchema.safeParse(input);
    if (!parsed.success)
      throw new Error(
        `Operation ${index + 1}: ${z.prettifyError(parsed.error)}`,
      );
    inverses.push(invertOne(current, parsed.data));
    const result = applyOperations(current, [input]);
    if (!result.ok)
      throw new Error(
        result.error.replace(/^Operation 1/, `Operation ${index + 1}`),
      );
    current = result.document;
  }
  return inverses.reverse().flat();
}

/** JSON with every object's keys in order, so equal values read the same. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : inner,
  );
}

/**
 * Everything `operations` change in `document`, as it stands there: the
 * layers they name (and the order of their face, when they add, remove or
 * move one), the palette colours, styles and piece settings they set, the
 * accessories, envelope or language. Undo compares it with how a batch left
 * the design, to tell whether something else has changed it since.
 */
export function touchedState(
  document: DesignDocument,
  operations: readonly Operation[],
): string {
  const parts = new Map<string, unknown>();
  for (const operation of operations) {
    switch (operation.op) {
      case "updateLayer":
      case "addLayer":
      case "removeLayer":
      case "moveLayer": {
        const { piece, face } = operation;
        const id =
          operation.op === "addLayer" ? operation.layer.id : operation.layer;
        const layers = findPiece(document, piece)?.[face]?.layers;
        parts.set(
          `layer:${piece}/${face}/${id}`,
          layers?.find((layer) => layer.id === id) ?? null,
        );
        if (operation.op !== "updateLayer")
          parts.set(
            `order:${piece}/${face}`,
            layers?.map((layer) => layer.id) ?? null,
          );
        break;
      }
      case "setPalette":
        for (const token of Object.keys(operation.palette))
          parts.set(
            `palette:${token}`,
            document.theme.palette[
              token as keyof typeof document.theme.palette
            ],
          );
        break;
      case "setTextStyle": {
        const style = document.theme.text[operation.style];
        for (const key of Object.keys(operation.set))
          parts.set(
            `style:${operation.style}.${key}`,
            style[key as keyof typeof style],
          );
        break;
      }
      case "updatePiece": {
        const piece = findPiece(document, operation.piece);
        for (const key of Object.keys(operation.set)) {
          if (key === "background") {
            const face = operation.face ?? "front";
            parts.set(
              `background:${operation.piece}/${face}`,
              piece?.[face]?.background ?? null,
            );
          } else
            parts.set(
              `piece:${operation.piece}.${key}`,
              piece?.[key as keyof Piece] ?? null,
            );
        }
        break;
      }
      case "setAccessory":
      case "removeAccessory":
        parts.set("accessories", document.accessories);
        break;
      case "setEnvelope":
        parts.set("envelope", document.envelope);
        break;
      case "setLanguage":
        parts.set("language", document.language);
        break;
    }
  }
  return stableJson(Object.fromEntries(parts));
}
