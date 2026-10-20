import { describe, expect, test } from "bun:test";
import { applyOperations, type Operation } from "../ops";
import { eucaliptInvitation } from "../samples";
import { type DesignDocument, parseDocument } from "../schema";
import {
  clearOverrides,
  duplicateLayers,
  newLayerId,
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
