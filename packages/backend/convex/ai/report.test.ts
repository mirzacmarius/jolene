import { describe, expect, test } from "bun:test";
import {
  applyOperations,
  type DesignDocument,
  eucaliptFields,
  eucaliptInvitation,
  type Operation,
  parseDocument,
} from "@jolene/design";
import { layoutReport } from "./report";

const invitation = parseDocument(eucaliptInvitation);

function changed(...operations: Operation[]): DesignDocument {
  const result = applyOperations(invitation, operations);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

describe("the layout report", () => {
  test("is empty when every word fits", () => {
    expect(layoutReport(invitation, eucaliptFields)).toEqual({
      measuredWith: "estimate",
      layers: [],
    });
  });

  test("lists words that shrink or overflow their frame", () => {
    const long = changed(
      {
        op: "updateLayer",
        piece: "card",
        face: "front",
        layer: "names",
        set: {
          text: "Anastasia-Maria Constantinescu & Mihai-Alexandru Popescu",
        },
      },
      {
        op: "updateLayer",
        piece: "card",
        face: "front",
        layer: "invite",
        set: {
          fit: "none",
          text: "vă invită cu drag să le fiți alături în ziua în care își unesc destinele, la biserică și apoi la petrecere, până dimineața",
        },
      },
    );
    const { layers } = layoutReport(long, eucaliptFields);
    const names = layers.find((layer) => layer.layer === "names");
    expect(names?.size).toBeLessThan(names?.styleSize ?? 0);
    expect(names?.overflows).toBe(false);
    expect(layers.find((layer) => layer.layer === "invite")).toMatchObject({
      overflows: true,
    });
  });

  test("lists words that reach past the safe margin", () => {
    const moved = changed({
      op: "updateLayer",
      piece: "card",
      face: "front",
      layer: "date",
      set: { frame: { x: 0, y: 86, width: 120, height: 7 }, align: "left" },
    });
    expect(layoutReport(moved, eucaliptFields).layers).toEqual([
      expect.objectContaining({ layer: "date", outsideSafeArea: true }),
    ]);
  });

  test("measures only the faces asked for, with the measure given", () => {
    const moved = changed({
      op: "updateLayer",
      piece: "card",
      face: "front",
      layer: "date",
      set: { frame: { x: 0, y: 86, width: 120, height: 7 }, align: "left" },
    });
    const elsewhere = layoutReport(moved, eucaliptFields, {
      faces: [{ piece: "vellum", face: "front" }],
      measure: (text, _font, size) => text.length * size * 0.1,
    });
    expect(elsewhere).toEqual({ measuredWith: "fonts", layers: [] });
  });
});
