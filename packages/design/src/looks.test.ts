import { describe, expect, test } from "bun:test";
import { applyLook, type Look, sameLook, showsLook } from "./looks";
import { applyOperations } from "./ops";
import { EUCALYPTUS_ASSET, eucaliptInvitation, eucaliptMenu } from "./samples";
import { type DesignDocument, parseDocument } from "./schema";

// A cotton card under a vellum band closed with a sage seal, in an envelope.
const invitation = parseDocument(eucaliptInvitation);
// One cotton card, with nothing tied round it and no envelope.
const menu = parseDocument(eucaliptMenu);

/** The design once the look is chosen, which must show it and stay valid. */
function choose(document: DesignDocument, look: Look): DesignDocument {
  const result = applyOperations(document, applyLook(document, look));
  if (!result.ok) throw new Error(result.error);
  expect(showsLook(result.document, look)).toBe(true);
  expect(applyLook(result.document, look)).toEqual([]);
  return result.document;
}

describe("paper", () => {
  const goldPearl: Look = {
    kind: "paper",
    stock: "pearl-300",
    color: "#E3CF9A",
  };

  test("changes every piece but the vellum", () => {
    const chosen = choose(invitation, goldPearl);
    const [card, vellum] = chosen.pieces;
    expect(card).toMatchObject({ stock: "pearl-300", paper: "#e3cf9a" });
    expect(vellum).toMatchObject({ stock: "vellum-110", paper: null });
  });

  test("a stock's own colour shows however the piece names it", () => {
    const plain: Look = { kind: "paper", stock: "cotton-350", color: null };
    expect(showsLook(invitation, plain)).toBe(true);
    const named = structuredClone(invitation);
    (named.pieces[0] as (typeof named.pieces)[number]).paper = "#f7f3ea";
    expect(showsLook(named, plain)).toBe(true);
    expect(showsLook(named, goldPearl)).toBe(false);
  });
});

describe("seal", () => {
  test("takes the chosen wax where it is", () => {
    const chosen = choose(invitation, { kind: "seal", color: "#8A5A2B" });
    expect(chosen.accessories).toHaveLength(1);
    expect(chosen.accessories[0]).toMatchObject({
      kind: "wax-seal",
      id: "seal",
      color: "#8a5a2b",
      x: 60,
      y: 150,
    });
  });

  test("a wax named in the catalog shows its colour", () => {
    expect(showsLook(invitation, { kind: "seal", color: "#8a9a7b" })).toBe(
      true,
    );
  });

  test("goes when none is chosen", () => {
    const chosen = choose(invitation, { kind: "seal", color: null });
    expect(chosen.accessories).toEqual([]);
    expect(showsLook(menu, { kind: "seal", color: null })).toBe(true);
  });

  test("a new one sits in the middle, low on the card, with the monogram", () => {
    const chosen = choose(menu, { kind: "seal", color: "#9b1c22" });
    expect(chosen.accessories).toEqual([
      {
        kind: "wax-seal",
        id: "seal",
        color: "#9b1c22",
        motif: { kind: "initials", text: "{{monogram}}" },
        diameter: 25,
        x: 49.5,
        y: 172.2,
      },
    ]);
  });
});

describe("ribbon", () => {
  const silk: Look = { kind: "ribbon", material: "chiffon", color: null };

  test("a new one is ivory, tied under the seal", () => {
    const chosen = choose(invitation, silk);
    expect(chosen.accessories[1]).toEqual({
      kind: "ribbon",
      id: "ribbon",
      material: "chiffon",
      color: "#f3eee4",
      width: 10,
      orientation: "horizontal",
      offset: 150,
      bow: false,
    });
  });

  test("keeps its colour unless the choice has one", () => {
    const tied = choose(menu, { ...silk, color: "#3f5a3a" });
    expect(showsLook(tied, silk)).toBe(true);
    const twine = choose(tied, {
      kind: "ribbon",
      material: "twine",
      color: "#c9a85c",
    });
    expect(twine.accessories[0]).toMatchObject({
      material: "twine",
      color: "#c9a85c",
      width: 3,
    });
    expect(showsLook(twine, silk)).toBe(false);
    expect(
      choose(twine, { kind: "ribbon", material: null, color: null })
        .accessories,
    ).toEqual([]);
  });

  test("a seal chosen after it sits on it", () => {
    const tied = choose(menu, silk);
    const sealed = choose(tied, { kind: "seal", color: "#b8913a" });
    const [ribbon, seal] = sealed.accessories;
    expect(ribbon?.kind === "ribbon" && seal?.kind === "wax-seal").toBe(true);
    if (ribbon?.kind === "ribbon" && seal?.kind === "wax-seal")
      expect(seal.y).toBe(ribbon.offset);
  });
});

describe("envelope and liner", () => {
  test("the envelope takes the colour and keeps its style", () => {
    const chosen = choose(invitation, { kind: "envelope", color: "#2F7D46" });
    expect(chosen.envelope).toEqual({
      style: "classic",
      color: "#2f7d46",
      liner: null,
    });
    expect(
      choose(menu, { kind: "envelope", color: "#ffffff" }).envelope,
    ).toEqual({ style: "classic", color: "#ffffff", liner: null });
  });

  test("a printed liner repeats the design's art on its ground", () => {
    const lined = choose(invitation, { kind: "liner", printed: true });
    expect(lined.envelope).toEqual({
      style: "classic",
      color: "#efe9dc",
      liner: { asset: EUCALYPTUS_ASSET, color: "$paper" },
    });
    const plain = choose(lined, { kind: "liner", printed: false });
    expect(plain.envelope).toEqual(invitation.envelope);
  });

  test("a liner brings a white envelope to a design without one", () => {
    expect(showsLook(menu, { kind: "liner", printed: false })).toBe(true);
    expect(
      choose(menu, { kind: "liner", printed: true }).envelope,
    ).toMatchObject({ style: "classic", color: "#ffffff" });
  });
});

describe("corners", () => {
  test("rounds the cards, not the vellum", () => {
    const rounded = choose(invitation, { kind: "corners", radius: 4 });
    expect(rounded.pieces.map((piece) => piece.shape)).toEqual([
      { kind: "rect", radius: 4 },
      { kind: "rect", radius: 0 },
    ]);
    expect(showsLook(rounded, { kind: "corners", radius: 0 })).toBe(false);
    expect(showsLook(invitation, { kind: "corners", radius: 0 })).toBe(true);
  });
});

test("sameLook ignores the case of colours", () => {
  expect(
    sameLook(
      { kind: "seal", color: "#B8913A" },
      { color: "#b8913a", kind: "seal" },
    ),
  ).toBe(true);
  expect(
    sameLook(
      { kind: "ribbon", material: "satin", color: null },
      { kind: "ribbon", material: "velvet", color: null },
    ),
  ).toBe(false);
  expect(sameLook(null, null)).toBe(true);
  expect(sameLook(null, { kind: "liner", printed: false })).toBe(false);
});
