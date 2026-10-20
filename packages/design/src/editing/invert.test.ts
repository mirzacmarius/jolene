import { describe, expect, test } from "bun:test";
import { applyOperations, type Operation } from "../ops";
import { eucaliptInvitation, eucaliptSaveTheDate } from "../samples";
import { type DesignDocument, parseDocument } from "../schema";
import { invertOperations, touchedState } from "./invert";

const invitation = parseDocument(eucaliptInvitation);
const saveTheDate = parseDocument(eucaliptSaveTheDate);
const front = { piece: "card", face: "front" } as const;

function apply(document: DesignDocument, operations: readonly Operation[]) {
  const result = applyOperations(document, operations);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

/**
 * Applies a batch, then its inverse as the backend receives it (JSON, which
 * drops undefined), and expects the document it started from.
 */
function undoes(document: DesignDocument, batch: Operation[]) {
  const after = apply(document, batch);
  const inverse = invertOperations(document, batch);
  const sent = JSON.parse(JSON.stringify(inverse)) as Operation[];
  expect(apply(after, sent)).toEqual(document);
  return inverse;
}

describe("invertOperations", () => {
  test("puts back a layer's frame, words, style and ink", () => {
    const inverse = undoes(invitation, [
      {
        op: "updateLayer",
        ...front,
        layer: "names",
        set: {
          frame: { y: 40, width: 90 },
          text: "{{partner2}} și {{partner1}}",
          style: "script",
          ink: "print",
          align: "left",
          rotation: 12,
        },
      },
    ]);
    // Every property had a value before, so one update says it all.
    expect(inverse).toEqual([
      {
        op: "updateLayer",
        ...front,
        layer: "names",
        set: {
          frame: { y: 51, width: 100 },
          text: "{{partner1}} & {{partner2}}",
          style: "names",
          ink: "foil-gold",
          align: "center",
          rotation: 0,
        },
      },
    ]);
  });

  test("changes an override back, or takes a new one off", () => {
    // "parents" overrides its size; "names" follows its style.
    undoes(invitation, [
      {
        op: "updateLayer",
        ...front,
        layer: "parents",
        set: { overrides: { size: 12 } },
      },
    ]);
    const inverse = undoes(invitation, [
      {
        op: "updateLayer",
        ...front,
        layer: "names",
        set: { overrides: { font: "Allura", size: 40 } },
      },
    ]);
    expect(inverse.map((operation) => operation.op)).toEqual([
      "removeLayer",
      "addLayer",
    ]);
  });

  test("takes off a name, a tint or a minimum size the layer didn't have", () => {
    undoes(saveTheDate, [
      { op: "updateLayer", ...front, layer: "title", set: { name: "Titlu" } },
    ]);
    undoes(saveTheDate, [
      { op: "updateLayer", ...front, layer: "title", set: { minSize: 18 } },
    ]);
    undoes(invitation, [
      { op: "updateLayer", ...front, layer: "sprig", set: { tint: null } },
    ]);
    const untinted = apply(invitation, [
      { op: "updateLayer", ...front, layer: "sprig", set: { tint: null } },
    ]);
    undoes(untinted, [
      { op: "updateLayer", ...front, layer: "sprig", set: { tint: "#123456" } },
    ]);
  });

  test("removes an added layer and adds back a removed one in its place", () => {
    undoes(invitation, [
      {
        op: "addLayer",
        ...front,
        index: 2,
        layer: {
          id: "line",
          type: "shape",
          shape: "line",
          frame: { x: 40, y: 70, width: 40, height: 0.3 },
          stroke: { color: "$art", width: 0.3 },
        },
      },
    ]);
    const inverse = undoes(invitation, [
      { op: "removeLayer", ...front, layer: "invite" },
    ]);
    expect(inverse[0]).toMatchObject({ op: "addLayer", index: 4 });
  });

  test("moves a layer back to its place in the stack", () => {
    undoes(invitation, [
      { op: "moveLayer", ...front, layer: "border", index: 9 },
    ]);
    undoes(invitation, [
      { op: "moveLayer", ...front, layer: "rsvp", index: 0 },
    ]);
  });

  test("restores the palette and the text styles", () => {
    const inverse = undoes(invitation, [
      { op: "setPalette", palette: { accent: "#7a4b5c", art: "#a0b090" } },
      {
        op: "setTextStyle",
        style: "body",
        set: { font: "EB Garamond", size: 12, italic: true },
      },
    ]);
    expect(inverse).toEqual([
      {
        op: "setTextStyle",
        style: "body",
        set: { font: "Cormorant Garamond", size: 11, italic: false },
      },
      { op: "setPalette", palette: { accent: "#56664a", art: "#76886a" } },
    ]);
  });

  test("restores a piece's paper, shape, place and the face's background", () => {
    undoes(invitation, [
      {
        op: "updatePiece",
        piece: "card",
        set: {
          stock: "pearl-250",
          paper: "$paper",
          shape: { kind: "arch" },
          background: "#f0e8dc",
        },
      },
      {
        op: "updatePiece",
        piece: "vellum",
        set: { place: { x: 2, y: 130, rotation: 3 }, safeMargin: 4 },
      },
    ]);
  });

  test("can't give a piece back a name it never had", () => {
    expect(() =>
      invertOperations(saveTheDate, [
        { op: "updatePiece", piece: "card", set: { name: "Cardul" } },
      ]),
    ).toThrow("had no name");
  });

  test("restores accessories in their order, the envelope and the language", () => {
    const seal = invitation.accessories[0];
    if (seal?.kind !== "wax-seal") throw new Error("The sample has a seal");
    const ribbon = {
      kind: "ribbon",
      id: "ribbon",
      material: "satin",
      color: "#e8d5c4",
      orientation: "horizontal",
      offset: 80,
    } as const;
    const three = apply(invitation, [
      { op: "setAccessory", accessory: ribbon },
      { op: "setAccessory", accessory: { ...seal, id: "seal-2", x: 20 } },
    ]);
    undoes(three, [{ op: "removeAccessory", id: "ribbon" }]);
    undoes(three, [{ op: "removeAccessory", id: "seal" }]);
    undoes(three, [{ op: "removeAccessory", id: "missing" }]);
    undoes(three, [
      { op: "setAccessory", accessory: { ...seal, color: "gold" } },
    ]);
    undoes(invitation, [{ op: "setAccessory", accessory: ribbon }]);
    undoes(invitation, [
      { op: "setEnvelope", envelope: { style: "pocket", color: "#1f2a44" } },
      { op: "setLanguage", language: "en" },
    ]);
    undoes(invitation, [{ op: "setEnvelope", envelope: null }]);
  });

  test("undoes a batch that changes the same layer twice", () => {
    undoes(invitation, [
      {
        op: "updateLayer",
        ...front,
        layer: "date",
        set: { frame: { x: 12 } },
      },
      {
        op: "updateLayer",
        ...front,
        layer: "date",
        set: { frame: { x: 14, y: 90 }, overrides: { tracking: 300 } },
      },
      { op: "moveLayer", ...front, layer: "date", index: 0 },
    ]);
  });

  test("undoes adding, moving and removing layers together", () => {
    undoes(invitation, [
      {
        op: "addLayer",
        ...front,
        layer: {
          id: "note",
          type: "text",
          style: "small",
          text: "Dress code: elegant",
          frame: { x: 12, y: 150, width: 96, height: 5 },
        },
      },
      {
        op: "updateLayer",
        ...front,
        layer: "note",
        set: { frame: { y: 152 }, name: "Notă" },
      },
      { op: "moveLayer", ...front, layer: "note", index: 1 },
      { op: "removeLayer", ...front, layer: "godparents" },
      { op: "moveLayer", ...front, layer: "sprig-bottom", index: 0 },
      { op: "removeLayer", ...front, layer: "border" },
    ]);
  });

  test("throws when the batch doesn't apply", () => {
    expect(() =>
      invertOperations(invitation, [
        { op: "setPalette", palette: { ink: "#000000" } },
        { op: "removeLayer", ...front, layer: "nothing" },
      ]),
    ).toThrow('Operation 2: No layer "nothing"');
  });
});

describe("touchedState", () => {
  const move: Operation[] = [
    {
      op: "updateLayer",
      ...front,
      layer: "names",
      set: { frame: { y: 49 } },
    },
  ];

  test("ignores changes to what the batch doesn't touch", () => {
    const elsewhere = apply(invitation, [
      { op: "setPalette", palette: { ink: "#000000" } },
      { op: "updateLayer", ...front, layer: "date", set: { text: "Mâine" } },
      { op: "moveLayer", ...front, layer: "date", index: 0 },
    ]);
    expect(touchedState(elsewhere, move)).toBe(touchedState(invitation, move));
  });

  test("sees a change to a layer the batch touches", () => {
    const moved = apply(invitation, move);
    expect(touchedState(moved, move)).not.toBe(touchedState(invitation, move));
    const restyled = apply(invitation, [
      { op: "updateLayer", ...front, layer: "names", set: { ink: "print" } },
    ]);
    expect(touchedState(restyled, move)).not.toBe(
      touchedState(invitation, move),
    );
  });

  test("sees the order of a face a batch adds to or reorders", () => {
    const remove: Operation[] = [
      { op: "removeLayer", ...front, layer: "rsvp" },
    ];
    const reordered = apply(invitation, [
      { op: "moveLayer", ...front, layer: "date", index: 0 },
    ]);
    expect(touchedState(reordered, remove)).not.toBe(
      touchedState(invitation, remove),
    );
  });

  test("reads the same whatever order an object's keys come in", () => {
    const shuffled = JSON.parse(
      JSON.stringify(invitation, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse())
          : value,
      ),
    ) as DesignDocument;
    expect(touchedState(shuffled, move)).toBe(touchedState(invitation, move));
  });
});
