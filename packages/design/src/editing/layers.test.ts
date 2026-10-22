import { describe, expect, test } from "bun:test";
import { applyOperations, type Operation } from "../ops";
import { eucaliptInvitation } from "../samples";
import { type DesignDocument, type Piece, parseDocument } from "../schema";
import {
  clearOverrides,
  duplicateLayers,
  newLayerId,
  previewLayers,
  removeLayers,
  restackLayers,
} from "./layers";

const invitation = parseDocument(eucaliptInvitation);
const front = { piece: "card", face: "front" } as const;

function apply(document: DesignDocument, operations: readonly Operation[]) {
  const result = applyOperations(document, operations);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

const order = (document: DesignDocument) =>
  document.pieces[0]?.front.layers.map((layer) => layer.id);

describe("newLayerId", () => {
  test("is free across pieces, layers and accessories", () => {
    expect(newLayerId(invitation, "text")).toBe("text");
    expect(newLayerId(invitation, "names")).toBe("names-2");
    // The vellum's layer and the seal share the document's ids.
    expect(newLayerId(invitation, "vellum-date")).toBe("vellum-date-2");
    expect(newLayerId(invitation, "seal")).toBe("seal-2");
  });

  test("makes a valid id of anything", () => {
    expect(newLayerId(invitation, "Ramură de Eucalipt!")).toBe(
      "ramur-de-eucalipt",
    );
    expect(newLayerId(invitation, "")).toBe("layer");
  });

  test("counts on from a copy's number", () => {
    const taken = new Set(["names", "names-2"]);
    expect(newLayerId(invitation, "names-2", taken)).toBe("names-3");
    expect(taken.has("names-3")).toBe(true);
  });
});

describe("duplicateLayers", () => {
  test("copies each layer just above itself, unlocked and shifted", () => {
    const { operations, ids } = duplicateLayers(
      invitation,
      front,
      ["sprig", "names"],
      3,
    );
    expect(ids).toEqual(["sprig-2", "names-2"]);
    const after = apply(invitation, operations);
    expect(order(after)?.slice(0, 6)).toEqual([
      "border",
      "sprig",
      "sprig-2",
      "parents",
      "names",
      "names-2",
    ]);
    const copy = after.pieces[0]?.front.layers[2];
    expect(copy?.locked).toBe(false);
    expect(copy?.frame).toEqual({ x: 33, y: 15, width: 60, height: 22 });
  });
});

describe("removeLayers", () => {
  test("deletes the layers and keeps the locked ones", () => {
    // The sprig is Jolene's artwork, locked; the names are the couple's.
    const { operations, kept } = removeLayers(invitation, front, [
      "sprig",
      "names",
      "missing",
    ]);
    expect(kept).toEqual(["sprig"]);
    const after = apply(invitation, operations);
    expect(order(after)).toContain("sprig");
    expect(order(after)).not.toContain("names");
    expect(order(after)).toHaveLength((order(invitation)?.length ?? 0) - 1);
  });

  test("takes a copy away, though its original is locked", () => {
    const copies = duplicateLayers(invitation, front, ["sprig"], 3);
    const copied = apply(invitation, copies.operations);
    const { operations, kept } = removeLayers(copied, front, copies.ids);
    expect(kept).toEqual([]);
    expect(order(apply(copied, operations))).toEqual(order(invitation));
  });
});

describe("restackLayers", () => {
  const restack = (ids: string[], how: Parameters<typeof restackLayers>[3]) =>
    order(apply(invitation, restackLayers(invitation, front, ids, how)));

  test("brings layers forward and back one step at a time", () => {
    expect(restack(["border"], "forward")?.slice(0, 3)).toEqual([
      "sprig",
      "border",
      "parents",
    ]);
    expect(restack(["parents"], "backward")?.slice(0, 3)).toEqual([
      "border",
      "parents",
      "sprig",
    ]);
  });

  test("sends several layers to the front or back in their own order", () => {
    expect(restack(["names", "border"], "front")?.slice(-2)).toEqual([
      "border",
      "names",
    ]);
    expect(restack(["rsvp", "names"], "back")?.slice(0, 2)).toEqual([
      "names",
      "rsvp",
    ]);
  });

  test("moves nothing that is already there", () => {
    expect(restackLayers(invitation, front, ["border"], "back")).toEqual([]);
    expect(
      restackLayers(invitation, front, ["sprig-bottom"], "forward"),
    ).toEqual([]);
  });
});

describe("clearOverrides", () => {
  test("lets a layer follow its style again", () => {
    const after = apply(
      invitation,
      clearOverrides(invitation, front, "parents", ["size"]),
    );
    const parents = after.pieces[0]?.front.layers.find(
      (layer) => layer.id === "parents",
    );
    expect(parents?.type === "text" && parents.overrides).toEqual({
      italic: true,
    });
    expect(order(after)).toEqual(order(invitation));
  });

  test("changes nothing when the layer has no such override", () => {
    expect(clearOverrides(invitation, front, "names", ["size"])).toEqual([]);
  });
});

describe("previewLayers", () => {
  const layersOf = (document: DesignDocument) =>
    document.pieces[0]?.front.layers ?? [];

  test("changes only the layers named, sharing everything else", () => {
    const preview = previewLayers(
      invitation,
      front,
      new Map([
        ["names", { frame: { width: 80 }, overrides: { size: 30 } }],
        ["sprig", { rotation: 12 }],
      ]),
    );
    const [before, after] = [layersOf(invitation), layersOf(preview)];
    const names = after.find((layer) => layer.id === "names");
    expect(names?.frame).toEqual({ x: 10, y: 51, width: 80, height: 18 });
    expect(names?.type === "text" && names.overrides.size).toBe(30);
    expect(after.find((layer) => layer.id === "sprig")?.rotation).toBe(12);
    expect(after[0]).toBe(before[0] as (typeof before)[number]);
    expect(preview.theme).toBe(invitation.theme);
    expect(preview.pieces[1]).toBe(invitation.pieces[1] as Piece);
    // The design itself is left as it was.
    expect(before.find((layer) => layer.id === "names")?.frame.width).toBe(100);
  });

  test("takes a tint off with null, as the operation does", () => {
    const tinted = apply(invitation, [
      {
        op: "updateLayer",
        ...front,
        layer: "sprig",
        set: { tint: "$accent" },
      },
    ]);
    const sprig = (document: DesignDocument) =>
      layersOf(document).find((layer) => layer.id === "sprig");
    const preview = previewLayers(
      tinted,
      front,
      new Map([["sprig", { tint: null }]]),
    );
    expect(Object.hasOwn(sprig(preview) ?? {}, "tint")).toBe(false);
    expect(sprig(tinted)?.type === "image" && sprig(tinted)).toHaveProperty(
      "tint",
      "$accent",
    );
  });

  test("returns the design itself when nothing changes", () => {
    expect(previewLayers(invitation, front, new Map())).toBe(invitation);
  });
});
